const Discord = require('discord.js');
const client = new Discord.Client();
const { token, prefix } = require('./config.json');
const { MessageEmbed } = require('discord.js');
const EventEmitter = require('events');

// TODO: Make this configurable later on...
const deleteAfter = 20;
const minimumToStart = 5;
const exemptRoles = [
    "752597339776090182",   // Admin
    "755416269179846677",   // Senior Support
    "752597548883247530",   // Support
    "754800267882397828"    // Developer
];
const logChannelId = '758423762751455246';
const everyoneRoleId = '752589945335709727';
const lockoutRoleId = '758385527811604531';
const percentageAgreement = 0.7;

client.on("ready", () => {
    console.log(`${client.user.tag} is online!`)
    client.generateInvite('ADMINISTRATOR')
        .then(link => console.log(`Generated bot invite link: ${link}`)).catch(console.error);
    client.user.setActivity(`!help`, { type: `PLAYING` });
});


// Do not edit below this line if you don't know what you're doing.
const voiceEmitter = new EventEmitter();
let currentlyVoting = [];

client.on('message', async message => {
    if (message.channel.type === 'dm' || message.author.bot) return;

    if (message.content === `${prefix}help`) {
        const embed = new MessageEmbed()
            .setTitle('Among Us Help')
            .addField('Commands', `${prefix}votekick @user - Make a poll for whether or not to kick user`)
            .setColor('RANDOM')

        message.channel.send(embed);
    }

    if (message.content.startsWith(`${prefix}votekick`)) {
        const target = message.mentions.members.first();

        // Delete user message
        await message.delete();

        const voiceChannel = message.member.voice.channel;
        let channelMemberCount = voiceChannel.members.filter(r => !r.user.bot).size;
        let minimumVotes = Math.round(channelMemberCount * percentageAgreement);

        if (channelMemberCount < minimumToStart)
            return message.channel.send(`I'm sorry but you can't start a vote kick under ${minimumToStart} people. Please contact support for further assistance`)
                .then(m => m.delete({ timeout: deleteAfter * 1000 }));

        if (target.id === message.author.id)
            return message.channel.send('You can\'t kick yourself, good attempt though!')
                .then(m => m.delete({ timeout: deleteAfter * 1000 }));

        if (exemptRoles.indexOf(target.roles.highest.id) !== -1)
            return message.channel.send(`I\'m sorry but ${target} cannot be kicked!`)
                .then(m => m.delete({ timeout: deleteAfter * 1000 }));

        if (!message.member.voice.channel)
            return message.channel.send('You\'re not in a voice channel!')
                .then(m => m.delete({ timeout: deleteAfter * 1000 }));

        if (!target)
            return message.channel.send('I can\'t find the person you want to kick, please mention someone in your messsage')
                .then(m => m.delete({ timeout: deleteAfter * 1000 }));

        if (message.member.voice.channelID !== target.voice.channelID)
            return message.channel.send('I\'m sorry but you can\'t kick someone if you\'re not in the same voice channel.')
                .then(m => m.delete({ timeout: deleteAfter * 1000 }));

        if (currentlyVoting.indexOf(voiceChannel.id) !== -1)
            return message.channel.send('A vote is already in progress in this channel. Please try again later.')
                .then(m => m.delete({ timeout: deleteAfter * 1000 }));


        // Lock the voice channel and prevent duplicate votes.
        currentlyVoting.push(voiceChannel.id);
        await voiceChannel.updateOverwrite(everyoneRoleId, { CONNECT: false });

        let mentionText = '';
        voiceChannel.members.forEach(x => mentionText += `${x} `)

        const voteMsg = await message.channel.send( `A vote kick for ${target} was started by ${message.member}! **30 seconds votetime!**\nAt least ${minimumVotes} 👍 are required to pass the vote.\nReply to this message with 👍/👎\n*It doesn't count your vote if you're not in the actual voice channel!*\nCC: ${mentionText}`);
        const lockoutRole = message.guild.roles.cache.get(lockoutRoleId);

        const emitterSubscription = voiceEmitter.on(voiceChannel.id, async (newChannelMemberCount, newMinimumVotes) => {
            // Update the new numbers
            channelMemberCount = newChannelMemberCount;
            minimumVotes = newMinimumVotes;


            // Clear mentionText and update accordingly
            mentionText = '';
            voiceChannel.members.forEach(x => mentionText += `${x} `)


            if (newChannelMemberCount < minimumToStart) {
                message.channel.send('Too many people left during the vote, the vote has been cancelled.')
                    .then(m => m.delete({ timeout: deleteAfter * 1000 }));

                voteMsg.delete();
            } else {
                await voteMsg.edit( `A vote kick for ${target} was started by ${message.member}! **30 seconds votetime!**\nAt least ${minimumVotes} 👍 are required to pass the vote.\nReply to this message with 👍/👎\n*It doesn't count your vote if you're not in the actual voice channel!*\nCC: ${mentionText}`);
            }
        });


        await Promise.all([
            voteMsg.react('👍'),
            voteMsg.react('👎')
        ]);

        message.guild.channels.cache.get(logChannelId).send(
            new MessageEmbed()
                .setTitle("Vote kick started!")
                .addField("Started by:", `${message.author}`)
                .addField("Target:", `${target} \n ID: ${target.id}`)
                .addField("Channel:", `${voiceChannel}`)
                .setFooter(`Vote started at: `)
                .setTimestamp()
                .setColor("BLUE")
        );


        voteMsg.awaitReactions((reaction, user) => voiceChannel.members.has(user.id) && (reaction.emoji.name === '👍' || reaction.emoji.name === '👎'),
            { max: channelMemberCount, time: 30 * 1000 }).then(async collected => {

            if (channelMemberCount < minimumToStart)
                return message.guild.channels.cache.get(logChannelId).send(
                    new MessageEmbed()
                        .setTitle("Vote kick cancelled!")
                        .addField("Started by:", `${message.author}`)
                        .addField("Target:", `${target} \n ID: ${target.id}`)
                        .addField("Channel:", `${voiceChannel}`)
                        .addField("Result:", `Too many people left, vote cancelled.`)
                        .setFooter(`Vote ended at: `)
                        .setTimestamp()
                        .setColor("RED")
                );

            let yesVotes = 0;

            const users = collected.get('👍') ? await collected.get('👍').users.fetch() : [];

            users.forEach(user => {
                if (voiceChannel.members.has(user.id))
                    yesVotes++;
            });


            if (yesVotes >= minimumVotes) {
                message.channel.send(`Vote successful! ${yesVotes} people voted to kick out ${target}.`).then(m => m.delete({ timeout: deleteAfter * 1000 }));

                await target.user.send(`You've been removed from the voice channel and you can't join back until you message staff. Please created a ticket with ModMail!`)
                await target.roles.add(lockoutRole);
                await target.voice.kick("Vote kicked");

                message.guild.channels.cache.get(logChannelId).send(
                    new MessageEmbed()
                        .setTitle("Vote kick ended!")
                        .addField("Started by:", `${message.author}`)
                        .addField("Target:", `${target} \n ID: ${target.id}`)
                        .addField("Channel:", `${voiceChannel}`)
                        .addField("Result:", `${yesVotes}/${minimumVotes} people voted, ${target} was kicked`)
                        .setFooter(`Vote ended at: `)
                        .setTimestamp()
                        .setColor("RED")
                )
            } else {
                message.channel.send(`Vote failed, ${target} was not kicked. ${yesVotes} voted but a minimum of ${minimumVotes} were required`).then(m => m.delete({ timeout: deleteAfter * 1000 }));

                message.guild.channels.cache.get(logChannelId).send(
                    new MessageEmbed()
                        .setTitle("Vote kick ended!")
                        .addField("Started by:", `${message.author}`)
                        .addField("Target:", `${target} \n ID: ${target.id}`)
                        .addField("Channel:", `${voiceChannel}`)
                        .addField("Result:", `${yesVotes}/${minimumVotes} people voted, ${target} was not kicked`)
                        .setFooter(`Vote ended at: `)
                        .setTimestamp()
                        .setColor("GREEN")
                )
            }

        }).catch((e) => {
            message.channel.send(`Oops, an error occured! Please report this to a moderator.`).then(m => m.delete({ timeout: deleteAfter * 1000 }));
            message.guild.channels.cache.get(logChannelId).send(
                new MessageEmbed()
                    .setTitle("Vote kick failed!")
                    .addField("Error message:", e.toString())
                    .setFooter(`Occured at`)
                    .setTimestamp()
                    .setColor("RED")
            )
        }).finally(async () => {
            currentlyVoting = currentlyVoting.filter(x => x !== voiceChannel.id)
            await emitterSubscription.removeAllListeners(voiceChannel.id);

            if(voteMsg.deletable)
                voteMsg.delete();

            await voiceChannel.updateOverwrite(everyoneRoleId, { CONNECT: null });
        });
    }
});

client.on("voiceStateUpdate", (oldState, newState) => {
    if (oldState.channelID !== newState.channelID && oldState.channelID) {
        const newChannelMemberCount = oldState.channel.members.filter(r => !r.user.bot).size;
        const newMinimumVotes = Math.round(newChannelMemberCount * percentageAgreement)
        voiceEmitter.emit(oldState.channelID, newChannelMemberCount, newMinimumVotes);
    }
});

client.login(token);