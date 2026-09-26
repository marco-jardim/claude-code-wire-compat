// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Aggregate graph budget for one caller-supplied graph, not a serialized
 * request-size guarantee.
 *
 * Every walker measures the same way it always has (string lengths plus
 * structural overhead); only the ceiling is shared. It equals the Messages
 * API request-size limit of 32 MB read as binary megabytes (32 MiB), the
 * larger of the two readings, so that no request the API would accept is
 * refused locally: each walker's measure never exceeds the serialized JSON
 * size of the graph it inspects, apart from `undefined` values that
 * serialization omits. The genuine client applies no client-side cap at all.
 */
export const MAX_INPUT_SIZE = 32 * 1024 * 1024;

/**
 * Ceiling on objects and arrays in one body inspection. It keeps the one
 * container per ten budget units ratio the previous 100,000/1,000,000 pair
 * had, so raising the size ceiling does not make container count the binding
 * limit for realistic requests.
 */
export const MAX_INPUT_ITEMS = Math.floor(MAX_INPUT_SIZE / 10);

/**
 * Budget for composite graphs that carry a serialized body next to other
 * material: redaction evidence input (normalized request, serialized body,
 * pinned and effective profiles) and a built request handed back to the
 * parser (serialized body, headers, evidence). Each of the first two parts is
 * bounded by `MAX_INPUT_SIZE` for any request the API accepts; the third
 * multiple is headroom for profiles, headers and JSON punctuation.
 */
export const MAX_COMPOSITE_SIZE = 3 * MAX_INPUT_SIZE;
