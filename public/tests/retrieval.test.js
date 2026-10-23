
import test from "node:test";
import assert from "node:assert/strict";

import {
  tokens,
  chunkText,
  rankChunks,
  pickEvenly,
  buildContext,
} from "../retrieval.js";

test("tokens lowercases text and removes common stop words", () => {
  assert.deepEqual(tokens("The STUDENTS are learning APIs"), [
    "student",
    "learning",
    "apis",
  ]);
});

test("chunkText returns an empty array for empty text", () => {
  assert.deepEqual(chunkText(""), []);
});

test("chunkText splits text into multiple chunks", () => {
  const text = "First topic. ".repeat(100);
  const chunks = chunkText(text, 100);

  assert.ok(chunks.length > 1);
});

test("rankChunks prioritizes chunks matching the query", () => {
  const chunks = [
    "Cooking uses flour and water.",
    "JavaScript functions process data.",
    "Databases store application data.",
  ];

  const result = rankChunks(chunks, "JavaScript functions");

  assert.ok(result.includes(1));
  assert.equal(result[0], 1);
});

test("rankChunks falls back to the first chunks when nothing matches", () => {
  const chunks = ["Apples are fruits.", "Cars have wheels.", "Birds can fly."];

  assert.deepEqual(rankChunks(chunks, "quantum physics", 2), [0, 1]);
});

test("pickEvenly returns every index when the list is short enough", () => {
  assert.deepEqual(pickEvenly(["a", "b", "c"], 5), [0, 1, 2]);
});

test("pickEvenly selects spread-out indexes for a longer list", () => {
  const result = pickEvenly(Array.from({ length: 10 }, (_, i) => i), 4);

  assert.equal(result.length, 4);
  assert.deepEqual(result, [1, 3, 6, 8]);
});

test("buildContext labels chunks using one-based section numbers", () => {
  assert.equal(
    buildContext(["First note", "Second note"], [0, 1]),
    "[Section 1]\nFirst note\n\n[Section 2]\nSecond note",
  );
});
