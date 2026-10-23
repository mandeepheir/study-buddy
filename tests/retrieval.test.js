
import test from "node:test";
import assert from "node:assert/strict";

import {
  tokens,
  chunkText,
  rankChunks,
  pickEvenly,
  buildContext,
} from "../retrieval.js";

// Test 1: Tokenization and simple plural stemming
test("tokens processes text", () => {
  assert.deepEqual(tokens("The STUDENTS are learning APIs"), [
    "student",
    "learning",
    "api",
  ]);
});

// Test 2: Empty input
test("chunkText handles empty text", () => {
  assert.deepEqual(chunkText(""), []);
});

// Test 3: Long text is split into multiple chunks
test("chunkText splits long text", () => {
  const chunks = chunkText("First topic. ".repeat(100), 100);

  assert.ok(chunks.length > 1);
});

// Test 4: Relevant chunks are ranked first
test("rankChunks finds matching content", () => {
  const chunks = [
    "Cooking uses flour and water.",
    "JavaScript functions process data.",
    "Databases store application data.",
  ];

  const result = rankChunks(chunks, "JavaScript functions");

  assert.ok(result.includes(1));
  assert.equal(result[0], 1);
});

// Test 5: Fallback when no chunks match
test("rankChunks falls back when nothing matches", () => {
  const chunks = [
    "Apples are fruits.",
    "Cars have wheels.",
    "Birds can fly.",
  ];

  assert.deepEqual(rankChunks(chunks, "quantum physics", 2), [0, 1]);
});

// Test 6: Short lists return all available indexes
test("pickEvenly returns all indexes for a short list", () => {
  assert.deepEqual(pickEvenly(["a", "b", "c"], 5), [0, 1, 2]);
});

// Test 7: Long lists return evenly spread indexes
test("pickEvenly spreads indexes across a longer list", () => {
  const chunks = Array.from({ length: 10 }, (_, i) => i);

  assert.deepEqual(pickEvenly(chunks, 4), [1, 3, 6, 8]);
});

// Test 8: Context includes correctly numbered sections
test("buildContext labels sections starting at one", () => {
  assert.equal(
    buildContext(["First note", "Second note"], [0, 1]),
    "[Section 1]\nFirst note\n\n[Section 2]\nSecond note",
  );
});
