// reallysimple.ts
// This is a translation of Dave Winer's reallysimple package on GitHub, https://github.com/scripting/reallysimple
// to TypeScript and adjusted to run under Deno 2.2.

// reallysimple.ts

const myProductName = "reallysimple";
const myVersion = "0.4.29";

import * as utils from "npm:daveutils";
import * as opml from "./opml.ts";
import * as davefeedread from "npm:davefeedread";
import * as marked from "npm:marked";
import * as emoji from "npm:node-emoji";

const allowedHeadNames = [
  "title",
  "link",
  "description",
  "language",
  "copyright",
  "managingEditor",
  "webMaster",
  "lastBuildDate",
  "pubDate",
  "category",
  "generator",
  "docs",
  "cloud",
  "ttl",
  "image",
  "rating",
  "textInput",
  "skipHours",
  "skipDays",
  "source:account",
  "source:localtime",
  "source:cloud",
  "linkToSelf",
  "source:blogroll",
];
const allowedItemNames = [
  "title",
  "link",
  "description",
  "author",
  "category",
  "comments",
  "enclosures",
  "guid",
  "pubDate",
  "source",
  "source:outline",
  "source:likes",
];
const allowedEnclosureNames = [
  "url",
  "type",
  "length",
];

interface Config {
  timeOutSecs: number;
  [key: string]: any; // Allow dynamic keys
}

interface FeedItem {
  title?: string;
  link?: string;
  description?: string;
  author?: string;
  category?: string;
  comments?: string;
  enclosures?: any[];
  guid?: string;
  pubDate?: string;
  source?: string;
  outline?: any;
  enclosure?: any;
  permalink?: string;
  markdowntext?: string;
  [key: string]: any; // Allow dynamic keys
}

interface Feed {
  title: string;
  items: FeedItem[];
  [key: string]: any; // Allow dynamic keys
}

interface OutlineNode {
  text: string;
  type: string;
  url: string;
}

interface Opml {
  opml: {
    head: {
      title: string;
      [key: string]: any; // Allow dynamic keys
    };
    body: {
      subs: OutlineNode[];
    };
  };
}

const config: Config = {
  timeOutSecs: 10,
};

export function setConfig(options: Partial<Config>): void {
  for (const x in options) {
    if (x in config) {
      config[x] = options[x];
    }
  }
}

function isEmptyObject(obj: any): boolean {
  try {
    return Object.keys(obj).length === 0;
  } catch (err) {
    return true;
  }
}

function getItemPermalink(item: any): string | undefined {
  const rssguid = item["rss:guid"];
  let returnedval: string | undefined = undefined;
  if (rssguid !== undefined) {
    const atts = rssguid["@"];
    if (atts !== undefined) {
      if (atts.ispermalink === undefined) {
        returnedval = rssguid["#"];
      } else {
        if (utils.getBoolean(atts.ispermalink)) {
          returnedval = rssguid["#"];
        }
      }
    }
  }
  if (returnedval !== undefined) {
    if (utils.beginsWith(returnedval, "http")) {
      return returnedval;
    }
  }
  return undefined;
}

async function markdownProcess(markdowntext: string): Promise<string> {
  const htmltext = await marked.parse(markdowntext);
  return htmltext;
}

function emojiProcess(s: string): string {
  return emoji.emojify(s);
}

export function convertFeedToOpml(theFeed: Feed): string {
  const theOutline: Opml = {
    opml: {
      head: {
        title: theFeed.title,
      },
      body: {
        subs: [],
      },
    },
  };
  theFeed.items.forEach((item) => {
    let linetext = item.title ?? item.description ?? "";
    let subtext = item.description;
    theOutline.opml.body.subs.push({
      text: linetext,
      type: "link",
      url: item.link ?? "",
    });
  });
  return opml.stringify(theOutline);
}

async function convertFeed(oldFeed: any, whenstart: Date): Promise<Feed> {
  const newFeed: Feed = {
    title: "",
    items: [],
  };

  function convertOutline(jstruct: any): any {
    const theNewOutline: any = {};
    if (jstruct["@"] !== undefined) {
      utils.copyScalars(jstruct["@"], theNewOutline);
    }
    if (jstruct["source:outline"] !== undefined) {
      if (Array.isArray(jstruct["source:outline"])) {
        const theArray = jstruct["source:outline"];
        theNewOutline.subs = [];
        theArray.forEach((item: any) => {
          theNewOutline.subs.push(convertOutline(item));
        });
      } else {
        theNewOutline.subs = [convertOutline(jstruct["source:outline"])];
      }
    }
    return theNewOutline;
  }

  function removeExtraAttributes(theNode: any): void {
    function visit(theNode: any): void {
      if (theNode.flincalendar !== undefined) {
        delete theNode.flincalendar;
      }
      if (theNode.subs !== undefined) {
        theNode.subs.forEach((sub: any) => {
          visit(sub);
        });
      }
    }
    visit(theNode);
  }

  function getHeadValuesFromFirstItem(): void {
    if (oldFeed.items.length > 0) {
      const item = oldFeed.items[0];
      if (item.meta !== undefined) {
        if (item.meta["source:account"] !== undefined) {
          const account = item.meta["source:account"];
          newFeed.accounts = {};
          if (Array.isArray(account)) {
            account.forEach((item: any) => {
              const service = item["@"].service;
              const name = item["#"];
              newFeed.accounts[service] = name;
            });
          } else {
            const service = account["@"].service;
            const name = account["#"];
            newFeed.accounts[service] = name;
          }
        }
        if (item.meta["source:localtime"] !== undefined) {
          const localtime = item.meta["source:localtime"];
          newFeed.localtime = localtime["#"];
        }
        if (item.meta["source:cloud"] !== undefined) {
          const cloud = item.meta["source:cloud"];
          newFeed.cloudUrl = cloud["#"];
        }
        if (item.meta["source:blogroll"] !== undefined) {
          const blogroll = item.meta["source:blogroll"];
          newFeed.blogroll = blogroll["#"];
        }
        if (item.meta["source:self"] !== undefined) {
          const linkToSelf = item.meta["source:self"];
          newFeed.linkToSelf = linkToSelf["#"];
        }
      }
    }
  }

  for (const x in oldFeed.head) {
    const val = oldFeed.head[x];
    if (val != null) {
      allowedHeadNames.forEach((name) => {
        if (x === name) {
          newFeed[x] = val;
        }
      });
    }
  }

  getHeadValuesFromFirstItem();

  if (newFeed.image !== undefined) {
    if (isEmptyObject(newFeed.image)) {
      delete newFeed.image;
    }
  }
  if (newFeed.cloud !== undefined) {
    if (isEmptyObject(newFeed.cloud)) {
      delete newFeed.cloud;
    }
  }

  newFeed.reader = {
    app: `${myProductName} v${myVersion} (${Deno.build.os})`,
    ctSecsToRead: utils.secondsSince(whenstart),
  };

  for (const item of oldFeed.items) {
    const newItem: FeedItem = {};
    for (const x in item) {
      const val = item[x];
      if (val != null) {
        allowedItemNames.forEach((name) => {
          if (x === name) {
            if (x === "source:outline") {
              let val = convertOutline(item["source:outline"]);
              removeExtraAttributes(val);
              newItem.outline = val;
            } else {
              if (x === "enclosures") {
                if (item.enclosures.length > 0) {
                  newItem.enclosure = item.enclosures[0];
                }
              } else {
                newItem[x] = val;
              }
            }
          }
        });
      }
    }
    newItem.permalink = getItemPermalink(item);
    if (newItem.source !== undefined) {
      if (isEmptyObject(newItem.source)) {
        delete newItem.source;
      }
    }

    if (newItem.enclosure !== undefined) {
      const enc: any = {};
      for (const x in newItem.enclosure) {
        allowedEnclosureNames.forEach((name) => {
          if (x === name) {
            if (newItem.enclosure[x] != null) {
              enc[x] = newItem.enclosure[x];
            }
          }
        });
      }
      newItem.enclosure = enc;
    }

    if (item["source:markdown"] !== undefined) {
      const markdowntext = item["source:markdown"]["#"];
      newItem.description = await markdownProcess(emojiProcess(markdowntext));
      newItem.markdowntext = markdowntext;
    }

    newFeed.items.push(newItem);
  }

  return newFeed;
}

export async function readFeed(url: string): Promise<Feed> {
  const whenstart = new Date();
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    config.timeOutSecs * 1000,
  );

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const text = await response.text();
    const theFeed = await davefeedread.parseString(text);
    return await convertFeed(theFeed, whenstart);
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw new Error(`Error reading feed: ${(err as Error).message}`);
  }
}
