import ExpoModulesCore
import UIKit

private final class LiteRTIOSInferenceException: Exception {
  override var reason: String {
    "L'inférence LiteRT-LM sur iOS n'est pas encore intégrée dans ce scaffold. Utilisez Android pour charger un modèle .litertlm."
  }
}

private final class ImageDecodeException: Exception {
  override var reason: String {
    "Impossible de décoder l'image"
  }
}

private final class ImageEncodeException: Exception {
  override var reason: String {
    "Échec de l'encodage JPEG"
  }
}

private extension UIImage {
  func litertScaled(maxSide: CGFloat) -> UIImage {
    let w = size.width
    let h = size.height
    let longest = max(w, h)
    if longest <= maxSide { return self }
    let scale = maxSide / longest
    let newSize = CGSize(width: floor(w * scale), height: floor(h * scale))
    let renderer = UIGraphicsImageRenderer(size: newSize)
    return renderer.image { _ in
      self.draw(in: CGRect(origin: .zero, size: newSize))
    }
  }
}

public class ExpoLiteRTModule: Module {
  public func definition() -> ModuleDefinition {
    Name("expo-litert")

    Events("onModelLoadProgress", "onToken", "onToolCall", "onError")

    AsyncFunction("loadModel") { (_: [String: Any]) -> [String: Any] in
      throw LiteRTIOSInferenceException()
    }

    AsyncFunction("unloadModel") { (_: String) in
      // no-op
    }

    AsyncFunction("generateText") { (_: String, _: String) -> [String: Any] in
      throw LiteRTIOSInferenceException()
    }

    AsyncFunction("generateStream") { (_: String, _: String) -> String in
      throw LiteRTIOSInferenceException()
    }

    AsyncFunction("cancelGeneration") { (_: String) in
      // no-op
    }

    AsyncFunction("encodeImage") { (imagePath: String) -> String in
      let path = imagePath.replacingOccurrences(of: "file://", with: "")
      let url = URL(fileURLWithPath: path)
      let data = try Data(contentsOf: url)
      guard let image = UIImage(data: data) else {
        throw ImageDecodeException()
      }
      let scaled = image.litertScaled(maxSide: 896)
      guard let jpeg = scaled.jpegData(compressionQuality: 0.9) else {
        throw ImageEncodeException()
      }
      return jpeg.base64EncodedString()
    }

    AsyncFunction("getModelInfo") { (_: String) -> [String: Any] in
      throw LiteRTIOSInferenceException()
    }

    AsyncFunction("listLoadedModels") { () -> [[String: Any]] in
      []
    }
  }
}
