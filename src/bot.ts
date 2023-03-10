import env from "dotenv";
env.config();
import { createWriteStream } from "fs";
import commands from "./utils/commands.json";
import { Key, Keyboard } from "telegram-keyboard";
import ytdl, { videoFormat } from "ytdl-core";
import { parse } from "./utils/yt-dlp";
import randomPATH from "./utils/randomPath";
import merge from "./utils/merge";
import clean from "./utils/clean";
import UpdateQulity from "./utils/updateQuality";
import getUser from "./utils/getUser";
import addUser from "./utils/addUser";
import bot from "./utils/createBot";

const qulaities = [
  {
    quality: 360,
    lable: "360p",
  },
  {
    quality: 720,
    lable: "720p",
  },
  {
    quality: 1080,
    lable: "1080p",
  },
  {
    quality: 1440,
    lable: "2K",
  },
  {
    quality: 2160,
    lable: "4K",
  },
];
const qulaities_list = qulaities.map((e) => e.quality);

const YTREGEXP = new RegExp("^(https?://)?((www.)?youtube.com|youtu.be)/.+$");
const not_command = new RegExp("^(?!/).*");

bot.settings((e) => {
  e.reply(
    "⚙️Settings⚙️",
    Keyboard.inline([
      Key.callback("Change Default Quality", "change_quality"),
      Key.callback("❌", "❌"),
    ])
  );
});

function getBestTrack(
  formats: Array<videoFormat>,
  quality: number
): videoFormat {
  console.log(formats);
  
  let fallbackFormat: videoFormat = formats[0];
  loop: for (let index = 0; index < formats.length; index++) {
    // @ts-ignore
    if (formats[index]?.height <= quality) {
      fallbackFormat = formats[index];
      break loop;
    }
  }
  return fallbackFormat;
}

bot.hears(YTREGEXP, async (e) => {
  try {
    e.sendChatAction("typing");
    e.reply("Working on it!");

    const UsersQulaity = await getUser(e.from.id.toString() || "");

    const quality = UsersQulaity ? UsersQulaity?.data()?.quality : 720;

    const info = await ytdl.getInfo(e.message.text);

    const parsedFormats = parse(info.formats);

    const vid =
    getBestTrack(parsedFormats.videoTracks, quality) || getBestTrack(parsedFormats.clips, quality)
      

    const aPath = randomPATH({ ext: ".ytd" });
    const vPath = randomPATH({ ext: ".ytd" });

    const videoStream = createWriteStream(vPath);
    const audioStream = createWriteStream(aPath);

    if (vid.hasAudio) {
      e.reply("Downloading Video");
      const downloadVid = ytdl(e.message.text, {
        filter: (format) => format.itag === vid.itag,
      });
      downloadVid.pipe(videoStream);

      videoStream.on("close", async () => {
        await e.sendChatAction("upload_video");
        e.replyWithVideo({ source: vPath });
      });

      videoStream.on("data", () => {
        console.log("ss");
        
      });

      videoStream.on("error", (err) => {
        e.reply(err.message);
      });
    } else {
      e.reply("Downloading Video1");
      const vi = ytdl(e.message.text, {
        filter: (format) => format.itag === vid.itag,
      });
      vi.pipe(videoStream);

      videoStream.on("close", () => {
        e.reply("Downloading Audio");
        const au = ytdl(e.message.text, {
          filter: (format) => format.itag === parsedFormats.audioTracks.itag,
        });

        au.pipe(audioStream);
        videoStream.on("close", () => {
          const mPath = randomPATH({ ext: ".ytd" });
          e.reply("Merging");
          merge({ aPath, mPath, vPath }).on("close", async () => {
            await e.replyWithVideo({ source: mPath });
            clean([aPath, vPath, mPath]);
          });
        });
      });
    }
  } catch (error) {
    console.log(error);

    e.reply("Something went wrong!");
  }
});

bot.hears([not_command], (e) => {
  e.reply("❌ Please send Valid YT Link ❌", {
    reply_to_message_id: e.message.message_id,
  });
});

const ChangeQualityKeyboard = Keyboard.inline([
  ...qulaities.map((quality) => Key.callback(quality.lable, quality.quality)),
  Key.callback("❌", "❌"),
]);

bot.on("callback_query", async (e) => {
  try {
    // @ts-ignore next-line
    switch (e.update.callback_query.data) {
      case "change_quality":
        await e.reply("Choose Default Quilty", ChangeQualityKeyboard);
        e.answerCbQuery();
        break;
      case "❌":
        await e.deleteMessage(e.message);
        break;

      default:
        break;
    }

    switch (true) {
      // @ts-ignore next-line
      case qulaities_list.includes(Number(e.update.callback_query.data)):
        // @ts-ignore next-line
        await UpdateQulity({
          // @ts-ignore next-line
          quality: e.update.callback_query.data,
          user_id: e.update.callback_query.from.id.toString(),
        });

        
        e.reply(
          // @ts-ignore
          `The Default Qulaity has ben changed to **${e.update.callback_query.data}**`,
          { parse_mode: "MarkdownV2" }
        );
        e.answerCbQuery();

        break;

      default:
        break;
    }
  } catch (error) {
    e.answerCbQuery();
  }
});

bot.start(async (ctx) => {
  try {
    await bot.telegram.setMyCommands(commands);
    const isUserAlreadyRegisterd = await getUser(ctx.from.id.toString() || "");
    if (isUserAlreadyRegisterd) return ctx.reply("Welcome back");

    await ctx.reply("Welcome");
    await addUser(ctx.from.id.toString() || "");
  } catch (error) {}
});

bot.launch();
