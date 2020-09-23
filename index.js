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

        if (!message.member.voice.channel) {
            const rejectMessage = await message.channel.send('You\'re not in a voice channel!');
            setTimeout(() => rejectMessage, deleteAfter * 1000);
            return;
        }

        if (target == null) {
            const rejectMessage = await message.channel.send('I can\'t find the person you want to kick, please mention someone in your messsage');
            setTimeout(() => rejectMessage, deleteAfter * 1000);
            return;

        }

        if (message.member.voice.channelID !== target.voice.channelID) {
            const rejectMessage = await message.channel.send('I\'m sorry but you can\'t kick someone if you\'re not in the same voice channel.');
            setTimeout(() => rejectMessage, deleteAfter * 1000);
            return;
        }

        const voiceChannel = message.member.voice.channel;
        const reset = voiceChannel.userLimit;

        const channelMemberCount = voiceChannel.members.filter(r => !r.user.bot).size;
        const minimumVotes = Math.ceil(channelMemberCount * 0.8);

        if (channelMemberCount < 3) {
            const rejectMessage = await message.channel.send('I\'m sorry but you can\'t start a vote kick under 5 people.');
            setTimeout(() => rejectMessage, deleteAfter * 1000);
            return;
        }

        const voteMsg = await message.channel.send(`A vote kick for ${target} was started by ${message.member}! **30 seconds votetime!**\nAt least ${minimumVotes} 👍 are required to pass the vote.\nReply to this message with 👍/👎\n*It doesn't count your vote if you're not in the actual voice channel!*`);
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
            { max: channelMemberCount, time: 30 * 1000 }).then(async collected => {

            if (collected.size === 0) {
                const finalMessage = message.channel.send(`No one voted!`);
                setTimeout(() => finalMessage.delete(), deleteAfter * 1000);
                voiceChannel.setUserLimit(reset)
                return;
            }

            let confirmMessage = null;
            const yesVotes = collected.get('👍') ? collected.get('👍').count - 1 : 0;

            if (yesVotes >= minimumVotes) {
                confirmMessage = await message.channel.send(`Vote successful! ${yesVotes} people voted to kick out ${target}, they won't be able to join for one hour.`)


                await target.roles.add(lockoutRole);
                await target.voice.kick("Vote kicked");
                voiceChannel.setUserLimit(reset)

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
                voiceChannel.setUserLimit(reset)
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

            voteMsg.delete();

            if (confirmMessage) 
                setTimeout(() => confirmMessage.delete(), deleteAfter * 1000)

        }).catch((e) => {
            voiceChannel.setUserLimit(reset)
            message.channel.send(`Oops, an error occured! Please report this to a moderator.`);
            console.log(e);
        });
    }
});

client.login(token);