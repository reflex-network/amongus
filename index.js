const Discord = require('discord.js');
const client = new Discord.Client();
const { token, prefix } = require('./config.json');
const { MessageEmbed } = require('discord.js');

client.on("ready", () => {
    console.log(`${client.user.tag} is online!`)
    client.generateInvite('ADMINISTRATOR')
        .then(link => console.log(`Generated bot invite link: ${link}`)).catch(console.error);
    client.user.setActivity(`!help`, { type: `PLAYING` });
});

const deleteAfter = 20;
const minimumToStart = 5;
const exemptRoles = [
    "752597339776090182",   // Admin
    "755416269179846677",   // Senior Support
    "752597548883247530",   // Support
    "754800267882397828"    // Developer
];


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

        if (target.id === message.author.id)
            return message.channel.send('You can\'t kick yourself, good attempt though!').then(m => m.delete({ timeout: deleteAfter * 1000 }));

        if (exemptRoles.indexOf(target.roles.highest.id) !== -1)
            return message.channel.send(`I\'m sorry but ${target} cannot be kicked!`).then(m => m.delete({ timeout: deleteAfter * 1000 }));

        if (!message.member.voice.channel)
            return message.channel.send('You\'re not in a voice channel!').then(m => m.delete({ timeout: deleteAfter * 1000 }));

        if (!target)
            return message.channel.send('I can\'t find the person you want to kick, please mention someone in your messsage').then(m => m.delete({ timeout: deleteAfter * 1000 }));

        if (message.member.voice.channelID !== target.voice.channelID)
            return message.channel.send('I\'m sorry but you can\'t kick someone if you\'re not in the same voice channel.').then(m => m.delete({ timeout: deleteAfter * 1000 }));


        const voiceChannel = message.member.voice.channel;
        let channelMemberCount = voiceChannel.members.filter(r => !r.user.bot).size;
        let minimumVotes = Math.ceil(channelMemberCount * 0.8);

        if (channelMemberCount < minimumToStart)
            return message.channel.send(`I'm sorry but you can't start a vote kick under ${minimumToStart} people. Please contact support for further assistance`).then(m => m.delete({ timeout: deleteAfter * 1000 }));

        // Lock the voice channel before sending a message.
        await voiceChannel.updateOverwrite('752589945335709727', { CONNECT: false });

        let mentionText = '';
        voiceChannel.members.forEach(x => mentionText += `${x} `)

        const voteMsg = await message.channel.send(`A vote kick for ${target} was started by ${message.member}! **30 seconds votetime!**\nAt least ${minimumVotes} 👍 are required to pass the vote.\nReply to this message with 👍/👎\n*It doesn't count your vote if you're not in the actual voice channel!*\nCC: ${mentionText}`);
        const lockoutRole = message.guild.roles.cache.get('758385527811604531');


        await Promise.all([
            voteMsg.react('👍'),
            voteMsg.react('👎')
        ]);

        message.guild.channels.cache.get('758423762751455246').send(
            new MessageEmbed()
                .setTitle("Vote kick started!")
                .addField("Started by:", `${message.author}`)
                .addField("Target:", `${target} \n ID: ${target.id}`)
                .addField("Voicechannel:", `${voiceChannel}`)
                .setFooter(`Vote started at: `)
                .setTimestamp()
                .setColor("BLUE")
        );


        voteMsg.awaitReactions((reaction, user) => voiceChannel.members.has(user.id) && (reaction.emoji.name === '👍' || reaction.emoji.name === '👎'),
            { max: channelMemberCount, time: 30 * 1000 }).then(async collected => {

            // Before starting anything we recalculate the amt of ppl in the voice call
            channelMemberCount = voiceChannel.members.filter(r => !r.user.bot).size;
            minimumVotes = Math.ceil(channelMemberCount * 0.8);

            let yesVotes = 0;

            const users = collected.get('👍') ? await collected.get('👍').users.fetch() : [];

            users.forEach(user => {
                if (voiceChannel.members.has(user.id))
                    yesVotes++;
            });

            if (channelMemberCount < minimumToStart)
                return message.channel.send(`I'm sorry but there are no longer a minimum of ${minimumToStart} people. Vote has been cancelled. Please contact support for further assistance`).then(m => m.delete({ timeout: deleteAfter * 1000 }));

            if (yesVotes >= minimumVotes) {
                message.channel.send(`Vote successful! ${yesVotes} people voted to kick out ${target}.`).then(m => m.delete({ timeout: deleteAfter * 1000 }));

                await target.user.send(`You've been removed from the voice channel and you can't join back until you message staff. Please created a ticket with ModMail!`)
                await target.roles.add(lockoutRole);
                await target.voice.kick("Vote kicked");

                message.guild.channels.cache.get('758423762751455246').send(
                    new MessageEmbed()
                        .setTitle("Vote kick ended!")
                        .addField("Started by:", `${message.author}`)
                        .addField("Target:", `${target} \n ID: ${target.id}`)
                        .addField("Voicechannel:", `${voiceChannel}`)
                        .addField("Result:", `${yesVotes}/${minimumVotes} people voted, ${target} was kicked`)
                        .setFooter(`Vote ended at: `)
                        .setTimestamp()
                        .setColor("RED")
                )
            } else {
                message.channel.send(`Vote failed, ${target} was not kicked. ${yesVotes} voted but a minimum of ${minimumVotes} were required`).then(m => m.delete({ timeout: deleteAfter * 1000 }));

                message.guild.channels.cache.get('758423762751455246').send(
                    new MessageEmbed()
                        .setTitle("Vote kick ended!")
                        .addField("Started by:", `${message.author}`)
                        .addField("Target:", `${target} \n ID: ${target.id}`)
                        .addField("Voicechannel:", `${voiceChannel}`)
                        .addField("Result:", `${yesVotes}/${minimumVotes} people voted, ${target} was not kicked`)
                        .setFooter(`Vote ended at: `)
                        .setTimestamp()
                        .setColor("GREEN")
                )
            }

        }).catch((e) => {
            message.channel.send(`Oops, an error occured! Please report this to a moderator.`).then(m => m.delete({ timeout: deleteAfter * 1000 }));
            message.guild.channels.cache.get('758423762751455246').send(
                new MessageEmbed()
                    .setTitle("Vote kick failed!")
                    .addField("Error message:", e.toString())
                    .setFooter(`Occured at`)
                    .setTimestamp()
                    .setColor("RED")
            )
        }).finally(async () => {
            await voteMsg.delete();
            await voiceChannel.updateOverwrite('752589945335709727', { CONNECT: null });
        });
    }
});

client.login(token);