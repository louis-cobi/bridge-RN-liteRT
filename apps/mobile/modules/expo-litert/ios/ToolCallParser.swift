import Foundation

struct ParsedToolResponse {
  let text: String
  let toolCalls: [[String: String]]?
}

enum ToolCallParserSwift {
  static func parseResponse(_ rawText: String) -> ParsedToolResponse {
    let trimmed = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let range = trimmed.range(of: "\"tool_calls\"") else {
      return ParsedToolResponse(text: trimmed, toolCalls: nil)
    }
    // Parsing minimal : la logique complète est côté Kotlin / TypeScript.
    return ParsedToolResponse(text: String(trimmed[..<range.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines), toolCalls: nil)
  }
}
