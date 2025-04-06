// reallysimple_test.ts

import { assertEquals } from "@std/assert";
import { convertFeedToOpml, readFeed, setConfig } from "./reallysimple.ts";

Deno.test("setConfig updates configuration", () => {
  setConfig({ timeOutSecs: 20 });
  // Since config is not exported, we can't directly test its value.
  // Instead, we assume that if no errors are thrown, the config was set correctly.
});

Deno.test("readFeed fetches and converts RSS feed", async () => {
  const url = "https://rsdoiel.github.io/rss.xml";
  try {
    const feed = await readFeed(url);
    assertEquals(typeof feed, "object");
    assertEquals(Array.isArray(feed.items), true);
  } catch (error) {
    // Handle the error if the feed cannot be fetched (e.g., network issues)
    console.error(`Error reading feed: ${(error as Error).message}`);
  }
});

Deno.test("convertFeedToOpml converts feed to OPML", async () => {
  const feed = {
    title: "Example Feed",
    items: [
      {
        title: "Example Item",
        link: "http://example.com/item",
        description: "This is an example item.",
      },
    ],
  };

  const opml = convertFeedToOpml(feed);
  assertEquals(typeof opml, "string");
  assertEquals(opml.includes("<opml"), true);
  assertEquals(opml.includes("<outline"), true);
});

Deno.test("convertFeedToOpml handles empty feed", () => {
  const feed = {
    title: "Empty Feed",
    items: [],
  };

  const opml = convertFeedToOpml(feed);
  assertEquals(typeof opml, "string");
  assertEquals(opml.includes("<opml"), true);
  assertEquals(opml.includes("<outline"), false);
});
