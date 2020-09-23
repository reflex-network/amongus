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

        if (!message.member.voice.channel)
            return message.channel.send('You\'re not in a voice channel!');

        if(target == null)
            return message.channel.send('I can\'t find the person you want to kick, please mention someone in your messsage');

        if(message.member.voice.channelID !== target.voice.channelID)
            return message.channel.send('I\'m sorry but you can\'t kick someone if you\'re not in the same voice channel.');

        const voiceChannel = message.member.voice.channel;
        const channelMemberCount = voiceChannel.members.filter(r => !r.user.bot).size;
        const minimumVotes = Math.ceil(channelMemberCount * 0.8);


        const message = await message.channel.send(`A vote kick for ${target} has been created! **30 seconds votetime!**\nAt least ${minimumVotes} 👍 are required to pass the vote.\nReply to this message with 👍/👎\n*It doesn't count your vote if you're not in the actual voice channel!*`);
        const lockoutRole = message.guild.roles.cache.get('758385527811604531');

        message.guild.channels.cache.get('758423762751455246').send(
            new MessageEmbed()
                .setTitle("Vote kick started!")
                .addField("Started by", ``)
        )

        await Promise.all([
            message.react('👍'),
            message.react('👎')
        ]);


        message.awaitReactions((reaction, user) => voiceChannel.members.has(user.id) && (reaction.emoji.name === '👍' || reaction.emoji.name === '👎'),
            { max: channelMemberCount, time: 30000 }).then(collected => {

            const yesVotes = collected.get('👍').count - 1;

            if (yesVotes >= minimumVotes) {
                message.channel.send(`Vote successful! ${yesVotes} people voted to kick out ${target}, they won't be able to join for one hour.`);

                target.roles.add(lockoutRole);
                target.voice.kick("Vote kicked");


            } else {
                message.channel.send(`Vote failed, ${target} was not kicked. ${yesVotes} voted but a minimum of ${minimumVotes} were required`)
            }

            message.delete();
        }).catch((e) => {
            message.channel.send(`Oops, an error occured! Please report this to a moderator.`);
            console.log(e);
        });
    }
});

client.login(token);