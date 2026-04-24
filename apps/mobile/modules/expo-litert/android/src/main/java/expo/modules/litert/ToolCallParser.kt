package expo.modules.litert

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class ParsedResponse(
  val text: String,
  val toolCalls: List<BridgeToolCall>?
)

data class BridgeToolCall(
  val id: String,
  val name: String,
  val arguments: String
)

data class BridgeToolDefinition(
  val name: String,
  val description: String,
  val parameters: Map<String, Any?>
)

object ToolCallParser {
  fun openApiToolDescriptionJson(name: String, description: String, parameters: Map<String, Any?>): String {
    val o = JSONObject()
    o.put("name", name)
    o.put("description", description)
    o.put("parameters", mapToJson(parameters))
    return o.toString()
  }

  fun parseResponse(rawText: String): ParsedResponse {
    val trimmed = rawText.trim()
    val toolCalls = extractToolCallsJson(trimmed)
    if (toolCalls != null && toolCalls.isNotEmpty()) {
      val cleanText = stripToolCallsBlock(trimmed)
      return ParsedResponse(cleanText.ifBlank { trimmed }, toolCalls)
    }
    return ParsedResponse(trimmed, null)
  }

  fun buildSystemPromptWithTools(tools: List<BridgeToolDefinition>): String {
    if (tools.isEmpty()) return ""
    val arr = JSONArray()
    for (t in tools) {
      val o = JSONObject()
      o.put("name", t.name)
      o.put("description", t.description)
      o.put("parameters", mapToJson(t.parameters))
      arr.put(o)
    }
    return buildString {
      append("Tu peux appeler des outils. Schémas JSON suivants (format function calling) :\n")
      append(arr.toString(2))
    }
  }

  fun buildToolResultMessage(toolCallId: String, name: String, result: String): Map<String, Any?> {
    return mapOf(
      "role" to "tool",
      "toolCallId" to toolCallId,
      "name" to name,
      "content" to result
    )
  }

  fun validateToolCall(toolCall: BridgeToolCall, toolDef: BridgeToolDefinition): Boolean {
    return try {
      val args = JSONObject(toolCall.arguments)
      val required = (toolDef.parameters["required"] as? List<*>) ?: return true
      for (key in required) {
        if (!args.has(key.toString())) return false
      }
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun extractToolCallsJson(text: String): List<BridgeToolCall>? {
    val marker = "\"tool_calls\""
    val idx = text.indexOf(marker)
    if (idx < 0) return null
    val braceStart = text.indexOf('{', idx)
    if (braceStart < 0) return null
    val json = extractBalancedJson(text, braceStart) ?: return null
    return try {
      val root = JSONObject(json)
      val arr = root.optJSONArray("tool_calls") ?: return null
      val out = ArrayList<BridgeToolCall>()
      for (i in 0 until arr.length()) {
        val item = arr.optJSONObject(i) ?: continue
        val id = item.optString("id").ifBlank { "call_${UUID.randomUUID()}" }
        val fn = item.optJSONObject("function") ?: continue
        val name = fn.optString("name")
        val args = fn.optString("arguments")
        if (name.isNotBlank()) {
          out.add(BridgeToolCall(id = id, name = name, arguments = args.ifBlank { "{}" }))
        }
      }
      if (out.isEmpty()) null else out
    } catch (_: Exception) {
      null
    }
  }

  private fun stripToolCallsBlock(text: String): String {
    val idx = text.indexOf("\"tool_calls\"")
    if (idx <= 0) return text
    val before = text.substring(0, idx).trim()
    return before.removeSuffix(",").trim()
  }

  private fun extractBalancedJson(s: String, start: Int): String? {
    if (start >= s.length || s[start] != '{') return null
    var depth = 0
    var inString = false
    var escape = false
    for (i in start until s.length) {
      val c = s[i]
      if (inString) {
        if (escape) {
          escape = false
        } else if (c == '\\') {
          escape = true
        } else if (c == '"') {
          inString = false
        }
        continue
      }
      when (c) {
        '"' -> inString = true
        '{' -> depth++
        '}' -> {
          depth--
          if (depth == 0) return s.substring(start, i + 1)
        }
      }
    }
    return null
  }

  private fun mapToJson(map: Map<String, Any?>): JSONObject {
    val o = JSONObject()
    for ((k, v) in map) {
      when (v) {
        null -> o.put(k, JSONObject.NULL)
        is Map<*, *> -> o.put(k, mapToJson(v.entries.associate { it.key.toString() to it.value }))
        is List<*> -> o.put(k, listToJson(v))
        is Boolean -> o.put(k, v)
        is Int -> o.put(k, v)
        is Long -> o.put(k, v)
        is Double -> o.put(k, v)
        is Float -> o.put(k, v.toDouble())
        else -> o.put(k, v.toString())
      }
    }
    return o
  }

  private fun listToJson(list: List<*>): JSONArray {
    val a = JSONArray()
    for (item in list) {
      when (item) {
        null -> a.put(JSONObject.NULL)
        is Map<*, *> -> a.put(mapToJson(item.entries.associate { it.key.toString() to it.value }))
        is List<*> -> a.put(listToJson(item))
        is Boolean -> a.put(item)
        is Int -> a.put(item)
        is Long -> a.put(item)
        is Double -> a.put(item)
        is Float -> a.put(item.toDouble())
        else -> a.put(item.toString())
      }
    }
    return a
  }
}
