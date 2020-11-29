const Discord = require('discord.js');
const {VoiceText} = require('voice-text');
const {Readable} = require('stream');
const conf = require('config-reloadable');
const client = new Discord.Client();

let config = conf();
let voiceLists1 = {
    hikari: 'ひかり（女性）',
    haruka: 'はるか（女性）',
    takeru: 'たける（男性）',
    santa: 'サンタ',
    bear: '凶暴なクマ',
    show: 'ショウ（男性）'
};
let modeList1 = {
    1: 'HOYA VoiceText API'
};
let context;
let discordToken = null;
let voiceTextApiKey = null;
let prefix = "/";
let autoRestart = true;
let readMe = false;
let apiType = 1;
let voiceType = "haruka";
let blackList;
let channelHistory;
let speed = 100;
let pitch = 100;
const timeoutOffset = 5;
let timeout = timeoutOffset;

function readConfig() {
    discordToken = config.get('Api.discordToken');
    voiceTextApiKey = config.get('Api.voiceTextApiKey');
    prefix = config.get('Prefix');
    autoRestart = config.get('AutoRestart');
    if (typeof autoRestart !== 'boolean') throw new Error("Require a boolean type.");
    readMe = config.get('ReadMe');
    if (typeof readMe !== 'boolean') throw new Error("Require a boolean type.");
    apiType = config.get('Defalut.apiType');
    if (!modeList1[apiType]) throw new Error("Unknown api.");
    voiceType = config.get('Defalut.voiceType');
    if (!voiceLists1[voiceType]) throw new Error("Unknown voice.");
    blackList = config.get('BlackLists');
    return true;
}

function autoRestartFunc() {
    console.log(timeout + "秒後に再接続処理開始");
    setTimeout(() => {
        discordLogin();
    }, timeout * 1000);
    timeout *= 2;
}

async function voiceChanelJoin(channelId) {
    channelHistory = channelId;
    await channelId.join()
        .then(connection => { // Connection is an instance of VoiceConnection
            context = connection;
        })
        .catch(err => {
            console.log(err)
            return false
        });
    return true
}

function onErrorListen(error) {
    if (context && context.status !== 4) context.disconnect();
    client.destroy();
    console.error(error.name);
    console.error(error.message);
    console.error(error.code);
    console.error(error);
    if (client.status != null) {
        client.user.send(error, {code: true});
    } else {
        console.error("NOT CONNECT");
        if (error.code === "TOKEN_INVALID") process.exit(1);
        autoRestart ? autoRestartFunc() : process.exit(1);
    }
}

async function discordLogin() {
    console.log("DiscordBotログイン処理を実行")
    await client.login(discordToken); //Discord login token
    console.log("DiscordBotログイン処理を完了")
    console.log("ボイスチャンネルへの接続を試行");
    if (channelHistory && await voiceChanelJoin(channelHistory)) {
        console.log("ボイスチャンネルへ再接続成功");
    } else {
        console.log("直前に接続していたボイスチャンネル無し");
    }
    timeout = timeoutOffset;
}

readConfig();
let voicePattern1 = voiceType; //初期時のよみあげ音声
let mode = apiType;
const voiceText = new VoiceText(voiceTextApiKey); //Voice Text API key

discordLogin();

process.on('uncaughtException', onErrorListen);

process.on('unhandledRejection', onErrorListen);

client.on('ready', () => {
    console.log("Bot準備完了");
});

client.on('message', message => {
    // Voice only works in guilds, if the message does not come from a guild,
    // we ignore it
    if (!message.guild) return;

    if (message.content === prefix + 'join') {
        // Only try to join the sender's voice channel if they are in one themselves
        if (message.member.voice.channel) {
            if (!context || (context && context.status === 4)) {
                if (voiceChanelJoin(message.member.voice.channel)) {
                    console.log("ボイスチャンネルへ接続しました。");
                    message.channel.send('ボイスチャンネルへ接続しました。', {code: true});
                    message.reply("\nチャットの読み上げ準備ができました。切断時は" + prefix + "killです。\n" +
                        prefix + "mode で読み上げAPIを変更できます。\n " + prefix +
                        "voiceでよみあげ音声を選択できます。\n 音声が読み上げられない場合は" + prefix + "reconnectを試してみてください。");
                }
            } else {
                message.reply("既にボイスチャンネルへ接続済みです。");
            }
        } else {
            message.reply("まずあなたがボイスチャンネルへ接続している必要があります。");
        }
    }

    if (message.content === prefix + 'reconnect') {
        if (context && context.status !== 4) {
            context.disconnect();
            message.channel.send('15秒後にボイスチャンネルへ再接続します。', {code: true});
            if (message.member.voice.channel) {
                setTimeout(() => {
                    if (voiceChanelJoin(message.member.voice.channel)) {
                        console.log("ボイスチャンネルへ再接続しました。");
                        message.channel.send('ボイスチャンネルへ再接続しました。', {code: true});
                    }
                }, 15000);
            } else {
                message.reply("まずあなたがボイスチャンネルへ接続している必要があります。");
            }
        } else {
            message.reply("Botはボイスチャンネルに接続していないようです。");
        }
    }

    if (message.content === prefix + 'kill') {
        if (context && context.status !== 4) {
            context.disconnect();
            message.channel.send(':dash:');
        } else {
            message.reply('Botはボイスチャンネルに接続していないようです。');
        }
    }

    if (message.content.indexOf(prefix + 'mode') === 0) {
        let split = message.content.split(' ');
        if (1 < split.length) {
            if (modeList1[split[1]] != null) {
                mode = Number(split[1]);
                let modeMessage = "読み上げAPIを" + split[1] + " : " + modeList1[split[1]] + "に設定しました。";
                message.reply(modeMessage);
                yomiage({
                    msg: modeMessage,
                    cons: context
                })
            } else {
                mode = Number(split[1]);
                message.reply("指定されたAPIが不正です。指定可能なAPIは" + prefix + "modeで見ることが可能です。");
            }
        } else {
            let modeNames = "\n以下のAPIに切り替え可能です。 指定時の例：" + prefix + "mode 1\n";
            for (let indexes in modeList1) {
                modeNames = modeNames + indexes + " -> " + modeList1[indexes] + "\n";
            }
            message.reply(modeNames);
        }

    }

    if (message.content === prefix + 'type') {
        let typeMessage = "\n音声タイプ -> その説明\n";
        if (mode === 1) {
            for (let voiceLists1Key in voiceLists1) {
                typeMessage = typeMessage + voiceLists1Key + "->" + voiceLists1[voiceLists1Key] + "\n";
            }
        } else {
            typeMessage = typeMessage + "APIが不正です";
        }
        message.reply(typeMessage);
    }

    if (message.content.indexOf(prefix + 'voice') === 0) {
        let split = message.content.split(' ');
        if (mode === 1) {
            if (1 < split.length) {
                if (voiceLists1[split[1]] != null) {
                    voicePattern1 = split[1];
                    let voiceMessage = "読み上げ音声を" + split[1] + " : " + voiceLists1[split[1]] + "に設定しました。";
                    message.reply(voiceMessage);
                    yomiage({
                        msg: voiceMessage,
                        cons: context
                    });
                } else {
                    message.reply("指定された読み上げ音声タイプが不正です。指定可能な音声タイプは" + prefix + "typeで見ることが可能です。");
                }
            } else {
                message.reply("読み上げ音声タイプを指定する必要があります。例：" + prefix + "voice hikari 指定可能な音声タイプは" + prefix + "typeで見ることが可能です。");
            }
        }
    }

    if (message.content === prefix + 'reload') {
        config = conf.reloadConfigs();
        if (readConfig()) message.channel.send("コンフィグを再読み込みしました。");
    }

    if (message.content.indexOf(prefix + 'pitch') === 0) {
        let split = message.content.split(' ');
        if (mode === 1) {
            if (1 < split.length) {
                if (split[1] <= 200 && split[1] >= 50) {
                    pitch = Number(split[1]);
                    message.channel.send("読み上げ音声の高さを" + split[1] + "に変更しました。", {code: true});
                } else {
                    message.reply("読み上げ音声の高さは 50 ～ 200 の範囲内で設定してください。")
                }
            }
        }
    }

    if (message.content.indexOf(prefix + 'speed') === 0) {
        let split = message.content.split(' ');
        if (mode === 1) {
            if (1 < split.length) {
                if (split[1] <= 200 && split[1] >= 50) {
                    speed = Number(split[1]);
                    message.channel.send("読み上げ音声の速度を" + split[1] + "に変更しました。", {code: true});
                } else {
                    message.reply("読み上げ音声の速度は 50 ～ 200 の範囲内で設定してください")
                }
            }
        }
    }

    if (!(isBot() || isBlackListsFromID(message.member.id) || isBlackListsFromPrefixes(message.content)) && isRead(message.member.id)) {
        try {
            yomiage({
                msg: mention_replace(emoji_delete(url_delete(message.content + "。"))),
                cons: context
            })
        } catch (error) {
            console.log(error.message);
            message.channel.send(error.message, {code: true});
        }
    } else {
        console.log("読み上げ対象外のチャットです");
    }

    function isBlackListsFromPrefixes(cont) {
        let prefixes = blackList.get("prefixes");
        return prefixes.find(prefix => {
            return cont.indexOf(prefix) === 0;
        });
    }

    function isBlackListsFromID(menId) {
        let memberIds = blackList.get("memberIds");
        return memberIds.find(id => {
            return menId === id;
        });
    }

    function isBot() {
        let bots = blackList.get("bots");
        return bots ? message.author.bot : false;
    }

    function isRead(id) {
        return readMe === false ? id !== client.user.id : readMe;
    }

    function url_delete(str) {
        let pat = /(https?:\/\/[\x21-\x7e]+)/g;
        return str.replace(pat, " URL省略。");
    }

    function emoji_delete(str) {
        let pat = /(<:\w*:\d*>)/g;
        return str.replace(pat, "");
    }

    function mention_replace(str) {
        let pat = /<@!(\d*)>/g;
        let [matchAllElement] = str.matchAll(pat);
        if (matchAllElement === undefined) return str;
        return str.replace(pat, client.users.resolve(matchAllElement[1]).username);
    }

    function yomiage(obj) {
        if (obj.cons && obj.cons.status === 0 && (message.guild.id === context.channel.guild.id)) {
            mode_api(obj).then((buffer) => {
                obj.cons.play(bufferToStream(buffer)); //保存されたWAV再生
                console.log(obj.msg + 'の読み上げ完了');
            }).catch((error) => {
                console.log('error ->');
                console.error(error);
                message.channel.send(modeList1[mode] + "の呼び出しにエラーが発生しました。\nエラー内容:" + error.details[0].message, {code: true});
            });
        } else {
            console.log("Botがボイスチャンネルへ接続してません。");
        }
    }

    function mode_api(obj) {
        if (mode === 1) {
            return voiceText.fetchBuffer(obj.msg, {format: 'wav', speaker: voicePattern1, pitch: pitch, speed: speed});
        } else {
            throw Error("不明なAPIが選択されています:" + mode);
        }
    }

    function bufferToStream(buffer) {
        let stream = new Readable();
        stream.push(buffer);
        stream.push(null);
        return stream;
    }
});
