const Discord= require('discord.js');
const client = new Discord.Client();
const { token, prefix } = require('./config.json');
const { MessageEmbed } = require('discord.js');

client.on("ready", () => {
    console.log(`${client.user.tag} is online!`)
    client.generateInvite('ADMINISTRATOR')
  .then(link => console.log(`Generated bot invite link: ${link}`)).catch(console.error);
  client.user.setActivity(`!help`, {type: `PLAYING`});
});

client.on('message', async message => { 
    if (message.channel.type === 'dm') return;
    if (message.author.bot) return;

    if(message.content === `${prefix}help`) {
        let embed = new MessageEmbed()
        .setTitle('Among Us Help')
        .addField('Commands', `!votekick - Make a poll for whether or not to kick user`)
        .setColor('RANDOM')

        message.channel.send(embed);
    }



    let target = message.mentions.members.first();
    if(message.content === `${prefix}votekick ${target}`) {
        if(!message.member.voice.channel) return message.channel.send('You are not in a voicechannel! Join one to use this command!');
       let msg = await message.channel.send(`A votekick for ${target} has been created! **30 seconds votetime!** \n vote 👍 for yes, vote 👎 for no`);

        msg.react('👍')
        msg.react('👎');

        let vc = message.member.voice.channel;
        let lockout = message.guild.roles.cache.get('758385527811604531');
        let size = Math.ceil(vc.members.size * 0.8);

        msg.awaitReactions((reaction, user) => vc.members.has(user.id) && (reaction.emoji.name == '👍' || reaction.emoji.name == '👎'),
        { max: 10, time: 30000 }).then(collected => {
            let a = collected.get('👍').count - 1;
                if (a >= size) {
                        message.channel.send(`Vote successful! ${target} was kicked!`);
                        target.roles.add(lockout);
                        target.voice.kick("Vote kicked");
                } else {
                    message.channel.send(`Vote failed, ${a} voted yes but a minimum of ${size} were required`)
                }
            }).catch((e) => {
                message.channel.send(`there was an error! ${e}`);
                console.log(e);
        });
    }
});

client.login(token);