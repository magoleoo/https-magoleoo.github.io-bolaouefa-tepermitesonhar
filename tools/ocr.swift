import Foundation
import Vision
import AppKit

func recognizeText(at path: String) throws -> String {
    let url = URL(fileURLWithPath: path)
    guard let image = NSImage(contentsOf: url) else {
        throw NSError(domain: "ocr", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot open image \(path)"])
    }

    guard let tiff = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let cgImage = bitmap.cgImage else {
        throw NSError(domain: "ocr", code: 2, userInfo: [NSLocalizedDescriptionKey: "Cannot create CGImage \(path)"])
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.recognitionLanguages = ["pt-BR", "en-US", "es-ES"]

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    let observations = (request.results ?? []).compactMap { $0 as? VNRecognizedTextObservation }
    let sorted = observations.sorted {
        if abs($0.boundingBox.midY - $1.boundingBox.midY) > 0.02 {
            return $0.boundingBox.midY > $1.boundingBox.midY
        }
        return $0.boundingBox.minX < $1.boundingBox.minX
    }

    return sorted.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}

let args = CommandLine.arguments.dropFirst()
if args.isEmpty {
    fputs("usage: swift ocr.swift <image> [image...]\n", stderr)
    exit(1)
}

for path in args {
    print("=== \(path) ===")
    do {
        print(try recognizeText(at: path))
    } catch {
        fputs("error: \(error)\n", stderr)
    }
}
