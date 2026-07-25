// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { buildCanonicalBody } from "../../src/request-body.js";

const model = {
  id: "claude-sonnet-4-6",
  capabilities: {
    contextHint: true,
    adaptiveThinking: true,
    effort: true,
  },
};

function build(messages: readonly unknown[]) {
  return buildCanonicalBody({ maxTokens: 1024, messages }, model, [], {})[
    "messages"
  ];
}

describe("message content blocks", () => {
  it("round-trips thinking unchanged", () => {
    const block = {
      type: "thinking",
      signature: "signature-value",
      thinking: "private reasoning",
    };
    expect(build([{ role: "assistant", content: [block] }])).toEqual([
      { role: "assistant", content: [block] },
    ]);
  });

  it("round-trips redacted thinking unchanged", () => {
    const block = { type: "redacted_thinking", data: "encrypted-value" };
    expect(build([{ role: "assistant", content: [block] }])).toEqual([
      { role: "assistant", content: [block] },
    ]);
  });

  it("accepts an image block", () => {
    const block = {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: "aW1hZ2U=",
      },
    };
    expect(build([{ role: "user", content: [block] }])).toEqual([
      { role: "user", content: [block] },
    ]);
  });

  it("accepts a document block", () => {
    const block = {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: "cGRm",
      },
      citations: null,
      context: null,
      title: null,
    };
    expect(build([{ role: "user", content: [block] }])).toEqual([
      { role: "user", content: [block] },
    ]);
  });

  it("accepts non-text content inside a tool result", () => {
    const image = {
      type: "image",
      source: { type: "url", url: "https://example.com/image.png" },
    };
    const messages = [
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tool-1", name: "inspect", input: {} },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "tool-1", content: [image] },
        ],
      },
    ];
    expect(build(messages)).toEqual(messages);
  });

  it.each([
    {
      type: "base64",
      media_type: "image/jpeg",
      data: "anBlZw==",
    },
    { type: "base64", media_type: "image/gif", data: "Z2lm" },
    { type: "base64", media_type: "image/webp", data: "d2VicA==" },
    { type: "url", url: "https://example.com/image.webp" },
    { type: "file", file_id: "file-image" },
  ])("accepts image source $type/$media_type", (source) => {
    const block = { source, type: "image", cache_control: null };
    expect(build([{ role: "user", content: [block] }])).toEqual([
      { role: "user", content: [block] },
    ]);
  });

  it.each([
    { type: "base64", media_type: "application/pdf", data: "cGRm" },
    { type: "text", media_type: "text/plain", data: "plain text" },
    {
      type: "content",
      content: [
        { type: "text", text: "caption" },
        {
          type: "image",
          source: { type: "file", file_id: "file-nested-image" },
        },
      ],
    },
    { type: "content", content: "inline content" },
    { type: "url", url: "https://example.com/document.pdf" },
    { type: "file", file_id: "file-document" },
  ])("accepts document source $type", (source) => {
    const block = {
      source,
      type: "document",
      cache_control: null,
      citations: null,
      context: null,
      title: null,
    };
    expect(build([{ role: "user", content: [block] }])).toEqual([
      { role: "user", content: [block] },
    ]);
  });

  it("accepts a search result with nested citations", () => {
    const block = {
      content: [
        {
          text: "result",
          type: "text",
          citations: [
            {
              cited_text: "result",
              document_index: 0,
              document_title: null,
              end_char_index: 6,
              start_char_index: 0,
              type: "char_location",
            },
            {
              cited_text: "result",
              document_index: 0,
              document_title: "Document",
              end_block_index: 2,
              start_block_index: 1,
              type: "content_block_location",
            },
            {
              cited_text: "result",
              document_index: 0,
              document_title: null,
              end_page_number: 2,
              start_page_number: 1,
              type: "page_location",
            },
            {
              cited_text: "result",
              end_block_index: 2,
              search_result_index: 0,
              source: "source",
              start_block_index: 1,
              title: null,
              type: "search_result_location",
            },
            {
              cited_text: "result",
              encrypted_index: "encrypted",
              title: null,
              type: "web_search_result_location",
              url: "https://example.com",
            },
          ],
        },
      ],
      source: "https://example.com",
      title: "Example",
      type: "search_result",
      cache_control: null,
      citations: { enabled: true },
    };
    expect(build([{ role: "user", content: [block] }])).toEqual([
      { role: "user", content: [block] },
    ]);
  });

  it("accepts every tool-result content block in order", () => {
    const content = [
      { type: "text", text: "text", cache_control: null, citations: null },
      {
        type: "image",
        source: { type: "file", file_id: "file-image" },
      },
      {
        type: "search_result",
        content: [{ type: "text", text: "result" }],
        source: "source",
        title: "title",
      },
      {
        type: "document",
        source: { type: "text", media_type: "text/plain", data: "document" },
      },
      {
        type: "tool_reference",
        tool_name: "referenced-tool",
        cache_control: null,
      },
    ];
    const messages = [
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tool-2", name: "inspect", input: null },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "tool-2",
            cache_control: null,
            content,
          },
        ],
      },
    ];
    expect(build(messages)).toEqual(messages);
  });

  it("accepts omitted tool-result content", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tool-3", name: "inspect", input: [] },
        ],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "tool-3" }],
      },
    ];
    expect(build(messages)).toEqual(messages);
  });

  it.each(["scalar", [1, true], { z: 1 }, null])(
    "accepts JSON tool-use input %#",
    (input) => {
      const block = {
        id: "tool-input",
        input,
        name: "inspect",
        type: "tool_use",
        cache_control: null,
        caller: { tool_id: "server-tool", type: "code_execution_20250825" },
      };
      expect(build([{ role: "assistant", content: [block] }])).toEqual([
        { role: "assistant", content: [block] },
      ]);
    },
  );

  it.each([
    { type: "direct" },
    { tool_id: "server-tool", type: "code_execution_20260120" },
  ])("accepts tool caller $type", (caller) => {
    const block = {
      id: "tool-caller",
      input: {},
      name: "inspect",
      type: "tool_use",
      caller,
    };
    expect(build([{ role: "assistant", content: [block] }])).toEqual([
      { role: "assistant", content: [block] },
    ]);
  });

  it("rejects tool references as top-level blocks", () => {
    expect(() =>
      build([
        {
          role: "user",
          content: [{ type: "tool_reference", tool_name: "inspect" }],
        },
      ]),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it.each([
    { type: "unknown" },
    {
      type: "image",
      source: { type: "base64", media_type: "application/pdf", data: "bad" },
    },
    {
      type: "image",
      source: { type: "url", url: "https://example.com", extra: true },
    },
    { type: "document", source: { type: "unknown" } },
  ])("rejects invalid block or source %#", (block) => {
    expect(() => build([{ role: "user", content: [block] }])).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });
});
