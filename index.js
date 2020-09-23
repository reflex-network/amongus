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
const minimumToStart = 3;
const exemptRoles = [
    "752597339776090182",   // Admin
    "755416269179846677",   // Senior Support
    "752597548883247530",   // Support
    "754800267882397828"    // Developer
];


client.on('message', async message => {
    if (message.channel.type === 'dm') return;
    if (message.author.bot) return;

    if (message.content === `${prefix}help`) {
        const embed = new MessageEmbed()
            .setTitle('Among Us Help')
            .addField('Commands', `!votekick @user - Make a poll for whether or not to kick user`)
            .setColor('RANDOM')

        message.channel.send(embed);
    }

    if (message.content.startsWith(`${prefix}votekick`)) {
        const target = message.mentions.members.first();

        // Delete user message
        await message.delete();

        if (target.id === message.author.id) {
            const rejectMessage = await message.channel.send('You can\'t kick yourself, good attempt though!');
            setTimeout(() => rejectMessage.delete(), deleteAfter * 1000);
            return;
        }

        if (exemptRoles.indexOf(target.roles.highest.id) !== -1) {
            const rejectMessage = await message.channel.send(`I\'m sorry but ${target} cannot be kicked!`);
            setTimeout(() => rejectMessage.delete(), deleteAfter * 1000);
            return;
        }

        if (!message.member.voice.channel) {
            const rejectMessage = await message.channel.send('You\'re not in a voice channel!');
            setTimeout(() => rejectMessage.delete(), deleteAfter * 1000);
            return;
        }

        if (!target) {
            const rejectMessage = await message.channel.send('I can\'t find the person you want to kick, please mention someone in your messsage');
            setTimeout(() => rejectMessage.delete(), deleteAfter * 1000);
            return;

        }

        if (message.member.voice.channelID !== target.voice.channelID) {
            const rejectMessage = await message.channel.send('I\'m sorry but you can\'t kick someone if you\'re not in the same voice channel.');
            setTimeout(() => rejectMessage.delete(), deleteAfter * 1000);
            return;
        }

        const voiceChannel = message.member.voice.channel;
        const originalLimit = voiceChannel.userLimit;

        const channelMemberCount = voiceChannel.members.filter(r => !r.user.bot).size;
        const minimumVotes = Math.ceil(channelMemberCount * 0.8);

        if (channelMemberCount < minimumToStart) {
            const rejectMessage = await message.channel.send(`I'm sorry but you can't start a vote kick under ${minimumToStart} people. Please contact support for further assistance`);
            setTimeout(() => rejectMessage.delete(), deleteAfter * 1000);
            return;
        }

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
        )

        voiceChannel.setUserLimit(1)

        voteMsg.awaitReactions((reaction, user) => voiceChannel.members.has(user.id) && (reaction.emoji.name === '👍' || reaction.emoji.name === '👎'),
            { max: originalLimit === 0 ? 10 : originalLimit, time: 30 * 1000 }).then(async collected => {

            if (collected.size === 0) {
                const finalMessage = message.channel.send(`No one voted!`);
                setTimeout(() => finalMessage.delete(), deleteAfter * 1000);
                await voiceChannel.setUserLimit(originalLimit)
                return;
            }

            let confirmMessage = null;
            const yesVotes = collected.get('👍') ? collected.get('👍').count - 1 : 0;

            if (yesVotes >= minimumVotes) {
                confirmMessage = await message.channel.send(`Vote successful! ${yesVotes} people voted to kick out ${target}.`);


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
                confirmMessage = await message.channel.send(`Vote failed, ${target} was not kicked. ${yesVotes} voted but a minimum of ${minimumVotes} were required`);
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

            await voiceChannel.setUserLimit(originalLimit)
            await voteMsg.delete();

            if (confirmMessage)
                setTimeout(() => confirmMessage.delete(), deleteAfter * 1000)

        }).catch((e) => {
            voiceChannel.setUserLimit(originalLimit)
            message.channel.send(`Oops, an error occured! Please report this to a moderator.`);
            console.log(e);
        });
    }
});

client.login(token);