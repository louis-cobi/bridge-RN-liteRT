package expo.modules.litert

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import com.google.ai.edge.litertlm.OpenApiTool
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.tool
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

private class BridgeOpenApiTool(
  private val descriptionJson: String
) : OpenApiTool {
  override fun getToolDescriptionJsonString(): String = descriptionJson

  override fun execute(paramsJsonString: String): String =
    "{\"note\":\"execution_on_js\",\"params\":$paramsJsonString}"
}

private data class LoadedEngine(
  val modelId: String,
  val path: String,
  val engine: Engine
)

/** Conversion JSON → structures Kotlin (évite l’échec du bridge Expo sur Map imbriquées pour generateStream). */
private fun jsonObjectToMap(o: JSONObject): Map<String, Any?> {
  val m = mutableMapOf<String, Any?>()
  val keys = o.keys()
  while (keys.hasNext()) {
    val k = keys.next()
    m[k] = jsonValueToKotlin(o.get(k))
  }
  return m
}

private fun jsonValueToKotlin(v: Any?): Any? {
  if (v == null || v == JSONObject.NULL) return null
  return when (v) {
    is JSONObject -> jsonObjectToMap(v)
    is JSONArray -> {
      val list = ArrayList<Any?>()
      for (i in 0 until v.length()) {
        list.add(jsonValueToKotlin(v.get(i)))
      }
      list
    }
    else -> v
  }
}

private fun parseStreamRequestFromJson(requestJson: String): Triple<List<Map<String, Any?>>, List<Map<String, Any?>>, Pair<Float, Float>> {
  val root = JSONObject(requestJson)
  val messagesArr = root.getJSONArray("messages")
  val messages = ArrayList<Map<String, Any?>>()
  for (i in 0 until messagesArr.length()) {
    val item = messagesArr.get(i)
    if (item is JSONObject) {
      messages.add(jsonObjectToMap(item))
    }
  }
  val tools = ArrayList<Map<String, Any?>>()
  val toolsArr = root.optJSONArray("tools")
  if (toolsArr != null) {
    for (i in 0 until toolsArr.length()) {
      val item = toolsArr.get(i)
      if (item is JSONObject) {
        tools.add(jsonObjectToMap(item))
      }
    }
  }
  val temperature = (root.opt("temperature") as? Number)?.toFloat() ?: 0.7f
  val topP = (root.opt("topP") as? Number)?.toFloat() ?: 0.9f
  return Triple(messages, tools, Pair(temperature, topP))
}

class ExpoLiteRTModule : Module() {
  private val supervisor = SupervisorJob()
  private val moduleScope = CoroutineScope(supervisor + Dispatchers.Default)
  private val engines = ConcurrentHashMap<String, LoadedEngine>()
  private val streamJobs = ConcurrentHashMap<String, Job>()
  private val streamTokenBuffers = ConcurrentHashMap<String, StringBuilder>()
  private val streamTokenCounts = ConcurrentHashMap<String, Int>()
  private val mainHandler = Handler(Looper.getMainLooper())

  /**
   * Les callbacks LiteRT et runBlocking(IO) tournent hors du thread UI ; JSI/expo exige
   * souvent les événements côté main — sinon crash natif sans log Metro.
   */
  private fun emitUi(name: String, body: Map<String, Any?>) {
    val runnable = Runnable {
      try {
        sendEvent(name, body)
      } catch (e: Exception) {
        Log.e(LOG_TAG, "emitUi($name) failed", e)
      }
    }
    if (Looper.myLooper() == Looper.getMainLooper()) {
      runnable.run()
    } else {
      mainHandler.post(runnable)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("expo-litert")

    Events(
      "onModelLoadProgress",
      "onToken",
      "onToolCall",
      "onError"
    )

    OnDestroy {
      supervisor.cancel()
      engines.values.forEach { runCatching { it.engine.close() } }
      engines.clear()
    }

    AsyncFunction("loadModel") { raw: Map<String, Any?> ->
      runBlocking(Dispatchers.IO) {
        val modelPath = raw["modelPath"] as? String
          ?: throw CodedException("INVALID_ARG", "modelPath requis", null)
        val useGpu = (raw["useGpu"] as? Boolean) ?: false
        val modelId = (raw["modelId"] as? String) ?: UUID.randomUUID().toString()

        emitUi(
          "onModelLoadProgress",
          mapOf("modelId" to modelId, "progress" to 0.1, "status" to "vérification du fichier")
        )

        val file = File(modelPath)
        if (!file.exists()) {
          throw CodedException("MODEL_NOT_FOUND", "Fichier modèle introuvable: $modelPath", null)
        }

        emitUi(
          "onModelLoadProgress",
          mapOf("modelId" to modelId, "progress" to 0.35, "status" to "initialisation moteur")
        )

        val ctx = appContext.reactContext?.applicationContext
        val cacheDir = ctx?.cacheDir?.absolutePath

        val backend = if (useGpu) Backend.GPU() else Backend.CPU()
        val visionBackend = if (useGpu) Backend.GPU() else Backend.CPU()

        val config = EngineConfig(
          modelPath = modelPath,
          backend = backend,
          visionBackend = visionBackend,
          cacheDir = cacheDir
        )

        val engine = Engine(config)
        try {
          engine.initialize()
        } catch (e: OutOfMemoryError) {
          runCatching { engine.close() }
          throw CodedException("OOM", "Mémoire insuffisante pour charger le modèle", e)
        } catch (e: Exception) {
          runCatching { engine.close() }
          throw CodedException("INIT_FAILED", e.message ?: "Échec initialize()", e)
        }

        engines[modelId] = LoadedEngine(modelId, modelPath, engine)

        emitUi(
          "onModelLoadProgress",
          mapOf("modelId" to modelId, "progress" to 1.0, "status" to "prêt")
        )

        mapOf(
          "modelId" to modelId,
          "name" to file.nameWithoutExtension,
          "maxTokens" to 4096,
          "supportsVision" to true,
          "supportsTools" to true
        )
      }
    }

    AsyncFunction("unloadModel") { modelId: String ->
      runBlocking(Dispatchers.IO) {
        val entry = engines.remove(modelId) ?: return@runBlocking
        runCatching { entry.engine.close() }
      }
    }

    AsyncFunction("generateText") { raw: Map<String, Any?> ->
      runBlocking(Dispatchers.IO) {
        val modelId = raw["modelId"] as? String
          ?: throw CodedException("INVALID_ARG", "modelId requis", null)
        val requestJson = raw["requestJson"] as? String
          ?: throw CodedException("INVALID_ARG", "requestJson requis", null)
        val autoExecuteTools = raw["autoExecuteTools"] as? Boolean ?: false
        val entry = engines[modelId]
          ?: throw CodedException("NOT_LOADED", "Modèle non chargé: $modelId", null)

        val root = JSONObject(requestJson)
        val messagesArr = root.getJSONArray("messages")
        val messages = ArrayList<Map<String, Any?>>()
        for (i in 0 until messagesArr.length()) {
          val item = messagesArr.get(i)
          if (item is JSONObject) {
            messages.add(jsonObjectToMap(item))
          }
        }
        val tools = ArrayList<Map<String, Any?>>()
        val toolsArr = root.optJSONArray("tools")
        if (toolsArr != null) {
          for (i in 0 until toolsArr.length()) {
            val item = toolsArr.get(i)
            if (item is JSONObject) {
              tools.add(jsonObjectToMap(item))
            }
          }
        }
        val maxTokens = (root.opt("maxTokens") as? Number)?.toInt() ?: 512
        val temperature = (root.opt("temperature") as? Number)?.toFloat() ?: 0.7f
        val topP = (root.opt("topP") as? Number)?.toFloat() ?: 0.9f

        val started = SystemClock.elapsedRealtime()
        val promptChars = estimatePromptChars(messages)

        val systemText = StringBuilder()
        val history = ArrayList<Message>()
        splitMessagesForTurn(messages, systemText, history)

        val nativeTools = tools.map { m ->
          val name = m["name"] as? String ?: return@map null
          val desc = m["description"] as? String ?: ""
          @Suppress("UNCHECKED_CAST")
          val params = m["parameters"] as? Map<String, Any?> ?: emptyMap()
          val json = ToolCallParser.openApiToolDescriptionJson(name, desc, params)
          tool(BridgeOpenApiTool(json))
        }.filterNotNull()

        val last = history.removeLastOrNull()
          ?: throw CodedException("INVALID_ARG", "Historique vide", null)

        val cfg = ConversationConfig(
          systemInstruction = Contents.of(systemText.toString()),
          initialMessages = history,
          tools = nativeTools,
          automaticToolCalling = false,
          samplerConfig = SamplerConfig(topK = 64, topP = topP.toDouble(), temperature = temperature.toDouble())
        )

        entry.engine.createConversation(cfg).use { conversation ->
          val response = conversation.sendMessage(last)
          val text = messageText(response)
          val duration = SystemClock.elapsedRealtime() - started

          val bridgeTools = if (response.toolCalls.isNotEmpty()) {
            response.toolCalls.mapIndexed { idx, tc ->
              val id = try {
                val m = tc.javaClass.methods.find { it.name == "getId" }
                m?.invoke(tc) as? String
              } catch (_: Exception) {
                null
              } ?: "call_${UUID.randomUUID()}"

              mapOf(
                "id" to id,
                "name" to tc.name,
                "arguments" to tc.arguments
              )
            }
          } else {
            val parsed = ToolCallParser.parseResponse(text)
            if (parsed.toolCalls != null) {
              parsed.toolCalls.map {
                mapOf("id" to it.id, "name" to it.name, "arguments" to it.arguments)
              }
            } else null
          }

          val finalText = if (bridgeTools != null) {
            ToolCallParser.parseResponse(text).text
          } else {
            text
          }

          mapOf(
            "text" to finalText,
            "toolCalls" to bridgeTools,
            "promptTokens" to (promptChars / 4).coerceAtLeast(1),
            "completionTokens" to (finalText.length / 4).coerceAtLeast(0),
            "durationMs" to duration,
            "maxTokensRequested" to maxTokens
          )
        }
      }
    }

    AsyncFunction("generateStream") { modelId: String, requestJson: String ->
      val streamId = UUID.randomUUID().toString()
      val entry = engines[modelId]
        ?: throw CodedException("NOT_LOADED", "Modèle non chargé: $modelId", null)

      val (messages, tools, temps) = try {
        parseStreamRequestFromJson(requestJson)
      } catch (e: Exception) {
        throw CodedException("INVALID_ARG", "requestJson: ${e.message}", e)
      }
      val temperature = temps.first
      val topP = temps.second

      val systemText = StringBuilder()
      val history = ArrayList<Message>()
      splitMessagesForTurn(messages, systemText, history)
      val last = history.removeLastOrNull()
        ?: throw CodedException("INVALID_ARG", "Historique vide", null)

      val nativeTools = tools.map { m ->
        val name = m["name"] as? String ?: return@map null
        val desc = m["description"] as? String ?: ""
        @Suppress("UNCHECKED_CAST")
        val params = m["parameters"] as? Map<String, Any?> ?: emptyMap()
        val json = ToolCallParser.openApiToolDescriptionJson(name, desc, params)
        tool(BridgeOpenApiTool(json))
      }.filterNotNull()

      val cfg = ConversationConfig(
        systemInstruction = Contents.of(systemText.toString()),
        initialMessages = history,
        tools = nativeTools,
        automaticToolCalling = false,
        samplerConfig = SamplerConfig(topK = 64, topP = topP.toDouble(), temperature = temperature.toDouble())
      )

      streamTokenBuffers[streamId] = StringBuilder()
      streamTokenCounts[streamId] = 0

      val job = moduleScope.launch(Dispatchers.IO) {
        try {
          // sendMessageAsync est non bloquant : il faut garder la Conversation ouverte jusqu’à
          // onDone/onError. Sinon .use ferme tout de suite et le thread natif engine/* segfault.
          entry.engine.createConversation(cfg).use { conversation ->
            val streamFinished = CompletableDeferred<Unit>()
            val callback = object : MessageCallback {
              override fun onMessage(message: Message) {
                val piece = messageText(message)
                if (piece.isEmpty()) return
                val buf = streamTokenBuffers.getValue(streamId)
                buf.append(piece)
                val count = (streamTokenCounts[streamId] ?: 0) + 1
                streamTokenCounts[streamId] = count
                if (buf.length >= 16 || count % 12 == 0) {
                  val batch = buf.toString()
                  buf.clear()
                  emitUi(
                    "onToken",
                    mapOf(
                      "streamId" to streamId,
                      "token" to batch,
                      "done" to false,
                      "tokenCount" to count
                    )
                  )
                }
              }

              override fun onDone() {
                val buf = streamTokenBuffers.remove(streamId)
                val rest = buf?.toString().orEmpty()
                if (rest.isNotEmpty()) {
                  emitUi(
                    "onToken",
                    mapOf(
                      "streamId" to streamId,
                      "token" to rest,
                      "done" to true,
                      "tokenCount" to (streamTokenCounts.remove(streamId) ?: 0)
                    )
                  )
                } else {
                  emitUi(
                    "onToken",
                    mapOf(
                      "streamId" to streamId,
                      "token" to "",
                      "done" to true,
                      "tokenCount" to (streamTokenCounts.remove(streamId) ?: 0)
                    )
                  )
                }
                streamJobs.remove(streamId)
                streamFinished.complete(Unit)
              }

              override fun onError(throwable: Throwable) {
                Log.e(LOG_TAG, "stream onError", throwable)
                emitUi(
                  "onError",
                  mapOf(
                    "modelId" to modelId,
                    "code" to "STREAM_ERROR",
                    "message" to (throwable.message ?: throwable.toString())
                  )
                )
                streamJobs.remove(streamId)
                streamTokenBuffers.remove(streamId)
                streamTokenCounts.remove(streamId)
                streamFinished.complete(Unit)
              }
            }
            try {
              conversation.sendMessageAsync(last, callback)
            } catch (e: Exception) {
              Log.e(LOG_TAG, "sendMessageAsync failed", e)
              streamJobs.remove(streamId)
              streamTokenBuffers.remove(streamId)
              streamTokenCounts.remove(streamId)
              emitUi(
                "onError",
                mapOf("modelId" to modelId, "code" to "STREAM_START_FAILED", "message" to (e.message ?: ""))
              )
              streamFinished.complete(Unit)
              return@use
            }
            streamFinished.await()
          }
        } catch (e: Exception) {
          Log.e(LOG_TAG, "generateStream job failed", e)
          emitUi(
            "onError",
            mapOf("modelId" to modelId, "code" to "STREAM_FAILED", "message" to (e.message ?: ""))
          )
          streamJobs.remove(streamId)
        }
      }

      streamJobs[streamId] = job
      streamId
    }

    AsyncFunction("cancelGeneration") { streamId: String ->
      streamJobs.remove(streamId)?.cancel()
      streamTokenBuffers.remove(streamId)
      streamTokenCounts.remove(streamId)
    }

    AsyncFunction("encodeImage") { imagePath: String ->
      runBlocking(Dispatchers.IO) {
        val bmp0 = BitmapFactory.decodeFile(imagePath)
          ?: throw CodedException("IMAGE_DECODE", "Impossible de décoder l'image", null)
        val scaled = scaleBitmapMax(bmp0, 896)
        val os = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, 90, os)
        Base64.encodeToString(os.toByteArray(), Base64.NO_WRAP)
      }
    }

    AsyncFunction("getModelInfo") { modelId: String ->
      val entry = engines[modelId]
        ?: throw CodedException("NOT_LOADED", "Modèle non chargé", null)
      val file = File(entry.path)
      mapOf(
        "modelId" to entry.modelId,
        "name" to file.nameWithoutExtension,
        "maxTokens" to 4096,
        "supportsVision" to true,
        "supportsTools" to true
      )
    }

    AsyncFunction("listLoadedModels") {
      engines.values.map { e ->
        val file = File(e.path)
        mapOf(
          "modelId" to e.modelId,
          "name" to file.nameWithoutExtension,
          "path" to e.path,
          "maxTokens" to 4096,
          "supportsVision" to true,
          "supportsTools" to true
        )
      }
    }

    AsyncFunction("unloadAllModels") {
      runBlocking(Dispatchers.IO) {
        engines.values.forEach { runCatching { it.engine.close() } }
        engines.clear()
      }
    }

    AsyncFunction("getModelsDir") {
      val ctx = appContext.reactContext?.applicationContext
        ?: throw CodedException("NO_CONTEXT", "Context React manquant", null)
      val modelsDir = File(ctx.filesDir, "models")
      if (!modelsDir.exists()) modelsDir.mkdirs()
      modelsDir.absolutePath
    }

    AsyncFunction("listModelFiles") {
      val ctx = appContext.reactContext?.applicationContext
        ?: throw CodedException("NO_CONTEXT", "Context React manquant", null)
      val modelsDir = File(ctx.filesDir, "models")
      if (!modelsDir.exists()) modelsDir.mkdirs()
      modelsDir.listFiles()?.filter { it.extension == "litertlm" }?.map { f ->
        mapOf(
          "name" to f.name,
          "path" to f.absolutePath,
          "size" to f.length()
        )
      }.orEmpty()
    }

    AsyncFunction("deleteModelFile") { filePath: String ->
      val file = File(filePath)
      if (file.exists()) {
        file.delete()
      } else {
        throw CodedException("FILE_NOT_FOUND", "Fichier introuvable: $filePath", null)
      }
    }

    AsyncFunction("encodeImageBase64") { base64Data: String ->
      runBlocking(Dispatchers.IO) {
        val bytes = Base64.decode(base64Data, Base64.DEFAULT)
        val bmp0 = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
          ?: throw CodedException("IMAGE_DECODE", "Base64 image invalide", null)
        val scaled = scaleBitmapMax(bmp0, 896)
        val os = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, 90, os)
        Base64.encodeToString(os.toByteArray(), Base64.NO_WRAP)
      }
    }
  }

  private fun splitMessagesForTurn(
    messages: List<Map<String, Any?>>,
    systemText: StringBuilder,
    history: MutableList<Message>
  ) {
    for (msg in messages) {
      val role = msg["role"] as? String ?: continue
      when (role) {
        "system" -> {
          systemText.appendLine(contentToPlainText(msg["content"]))
        }
        "user" -> history.add(Message.user(buildUserContents(msg["content"])))
        "assistant" -> {
          val t = contentToPlainText(msg["content"])
          history.add(Message.model(t))
        }
        "tool" -> {
          val name = msg["name"] as? String ?: "tool"
          val result = contentToPlainText(msg["content"])
          history.add(
            Message.tool(
              Contents.of(Content.ToolResponse(name, result))
            )
          )
        }
      }
    }
  }

  private fun buildUserContents(content: Any?): Contents {
    when (content) {
      is String -> return Contents.of(content)
      is List<*> -> {
        val parts = ArrayList<Content>()
        for (item in content) {
          if (item !is Map<*, *>) continue
          @Suppress("UNCHECKED_CAST")
          val map = item as Map<String, Any?>
          when (map["type"]) {
            "text" -> {
              val text = map["text"] as? String ?: ""
              parts.add(Content.Text(text))
            }
            "image" -> {
              val b64 = map["imageBase64"] as? String
              if (b64 != null) {
                val path = writeBase64Image(b64)
                parts.add(Content.ImageFile(path))
              }
            }
          }
        }
        if (parts.isEmpty()) return Contents.of("")
        return Contents.of(*parts.toTypedArray())
      }
      else -> return Contents.of(content?.toString() ?: "")
    }
  }

  private fun contentToPlainText(content: Any?): String {
    return when (content) {
      is String -> content
      is List<*> -> {
        content.joinToString("\n") { part ->
          if (part is Map<*, *>) {
            when (part["type"]) {
              "text" -> part["text"]?.toString() ?: ""
              "image" -> "[image]"
              else -> part.toString()
            }
          } else part.toString()
        }
      }
      else -> content?.toString() ?: ""
    }
  }

  private fun writeBase64Image(b64: String): String {
    val bytes = Base64.decode(b64, Base64.DEFAULT)
    val bmp0 = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
      ?: throw CodedException("IMAGE_DECODE", "Base64 image invalide", null)
    val scaled = scaleBitmapMax(bmp0, 896)
    val ctx = appContext.reactContext?.applicationContext
      ?: throw CodedException("NO_CONTEXT", "Contexte React manquant", null)
    val file = File(ctx.cacheDir, "litert_img_${UUID.randomUUID()}.jpg")
    FileOutputStream(file).use { out ->
      scaled.compress(Bitmap.CompressFormat.JPEG, 90, out)
    }
    return file.absolutePath
  }

  private fun scaleBitmapMax(source: Bitmap, maxSide: Int): Bitmap {
    val w = source.width
    val h = source.height
    val longest = max(w, h)
    if (longest <= maxSide) return source
    val scale = maxSide.toFloat() / longest.toFloat()
    val nw = (w * scale).roundToInt().coerceAtLeast(1)
    val nh = (h * scale).roundToInt().coerceAtLeast(1)
    return Bitmap.createScaledBitmap(source, nw, nh, true)
  }

  private fun estimatePromptChars(messages: List<Map<String, Any?>>): Int {
    return messages.sumOf { contentToPlainText(it["content"]).length }
  }

  private fun messageText(message: Message): String {
    return try {
      val m = message.javaClass.methods.find { it.name == "getText" && it.parameterCount == 0 }
      (m?.invoke(message) as? CharSequence)?.toString().orEmpty()
    } catch (_: Exception) {
      ""
    }.ifBlank { message.toString() }
  }

  private companion object {
    private const val LOG_TAG = "ExpoLiteRT"
  }
}
