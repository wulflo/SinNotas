import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ANDROID_JAVA_ROOT = resolve("src-tauri/gen/android/app/src/main/java");
const PATCH_MARKER = "SinNotasSafeArea v2";
const LEGACY_MARKER = "SinNotasSafeArea";
const REQUIRED_IMPORTS = [
  "import android.content.res.Configuration",
  "import android.view.View",
  "import android.webkit.JavascriptInterface",
  "import android.webkit.WebView",
  "import androidx.core.view.ViewCompat",
  "import androidx.core.view.WindowInsetsCompat",
  "import androidx.webkit.WebViewCompat",
  "import androidx.webkit.WebViewFeature",
  "import kotlin.math.roundToInt",
];

function findMainActivity(directory) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = findMainActivity(entryPath);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name === "MainActivity.kt") {
      return entryPath;
    }
  }

  return null;
}

const mainActivityPath = findMainActivity(ANDROID_JAVA_ROOT);
if (!mainActivityPath) {
  console.error(
    "No se encontró src-tauri/gen/android/.../MainActivity.kt. " +
      "Ejecutá `npm run tauri android init -- --ci` antes de aplicar el parche.",
  );
  process.exit(1);
}

let source = readFileSync(mainActivityPath, "utf8");
if (source.includes(PATCH_MARKER)) {
  console.log(`El parche de safe area ya está aplicado en ${mainActivityPath}`);
  process.exit(0);
}
if (source.includes(LEGACY_MARKER)) {
  console.error(
    `El proyecto Android de ${mainActivityPath} tiene un parche de safe area anterior. ` +
      "Borrá `src-tauri/gen/android` y regeneralo con " +
      "`npm run tauri android init -- --ci` antes de ejecutar " +
      "`npm run android:patch`.",
  );
  process.exit(1);
}

const lastImportIndex = source
  .split("\n")
  .reduce((last, line, index) => (line.startsWith("import ") ? index : last), -1);
if (lastImportIndex < 0) {
  throw new Error(`No se encontraron imports en ${mainActivityPath}`);
}

const lines = source.split("\n");
const existingImports = new Set(lines.map((line) => line.trim()));
const missingImports = REQUIRED_IMPORTS.filter((line) => !existingImports.has(line));
lines.splice(lastImportIndex + 1, 0, ...missingImports);
source = lines.join("\n");

const classDeclaration = source.match(/class\s+MainActivity\s*:\s*TauriActivity\(\)\s*\{/);
if (!classDeclaration) {
  throw new Error(`No se encontró la clase MainActivity en ${mainActivityPath}`);
}

const members = [
  "",
  "  // SinNotasSafeArea v2: publica las insets reales de Android en variables CSS.",
  '  private var latestSafeAreaInsets = ""',
  "  private var currentWebView: WebView? = null",
  "",
  "  override fun onWebViewCreate(webView: WebView) {",
  "    super.onWebViewCreate(webView)",
  "    currentWebView = webView",
  "",
  '    webView.addJavascriptInterface(SafeAreaBridge(), "SinNotasSafeArea")',
  "",
  "    if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {",
  '      WebViewCompat.addDocumentStartJavaScript(webView, SAFE_AREA_SCRIPT, setOf("*"))',
  "    }",
  "",
  "    ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->",
  "      updateSafeAreaInsets(insets)",
  "      insets",
  "    }",
  "    // Algunos WebView no reciben WindowInsets aunque estén en edge-to-edge.",
  "    // La raíz de la ventana sí conserva las insets reales.",
  "    webView.addOnLayoutChangeListener { view, _, _, _, _, _, _, _, _ ->",
  "      view?.let { applyRootWindowInsets(it) }",
  "    }",
  "    webView.post { applyRootWindowInsets(webView) }",
  "    ViewCompat.requestApplyInsets(webView)",
  "  }",
  "",
  "  private fun applyRootWindowInsets(view: View) {",
  "    ViewCompat.getRootWindowInsets(view)?.let { updateSafeAreaInsets(it) }",
  "  }",
  "",
  "  private fun updateSafeAreaInsets(insets: WindowInsetsCompat) {",
  "    val bars = insets.getInsets(",
  "      WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()",
  "    )",
  "    val density = resources.displayMetrics.density",
  '    val json = """{"top":${(bars.top / density).roundToInt()},"right":${(bars.right / density).roundToInt()},"bottom":${(bars.bottom / density).roundToInt()},"left":${(bars.left / density).roundToInt()}}"""',
  "    if (json == latestSafeAreaInsets) return",
  "    latestSafeAreaInsets = json",
  "    currentWebView?.evaluateJavascript(SAFE_AREA_SCRIPT, null)",
  "  }",
  "",
  "  override fun onConfigurationChanged(newConfig: Configuration) {",
  "    super.onConfigurationChanged(newConfig)",
  "    currentWebView?.let { webView ->",
  "      webView.post { applyRootWindowInsets(webView) }",
  "    }",
  "  }",
  "",
  "  override fun onResume() {",
  "    super.onResume()",
  "    currentWebView?.let { webView ->",
  "      webView.post { applyRootWindowInsets(webView) }",
  "    }",
  "  }",
  "",
  "  private inner class SafeAreaBridge {",
  "    @JavascriptInterface",
  "    fun getInsets(): String = latestSafeAreaInsets",
  "  }",
  "",
  "  companion object {",
  '    private val SAFE_AREA_SCRIPT = """',
  "      (function () {",
  "        function apply(raw) {",
  "          try {",
  '            if (typeof raw === "string") raw = JSON.parse(raw);',
  "            if (!raw) return;",
  "            var root = document.documentElement;",
  "            if (!root) return;",
  '            root.style.setProperty("--sinnotas-safe-area-top", raw.top + "px");',
  '            root.style.setProperty("--sinnotas-safe-area-right", raw.right + "px");',
  '            root.style.setProperty("--sinnotas-safe-area-bottom", raw.bottom + "px");',
  '            root.style.setProperty("--sinnotas-safe-area-left", raw.left + "px");',
  "          } catch (e) {}",
  "        }",
  "        window.__sinNotasApplySafeArea = apply;",
  "        if (window.SinNotasSafeArea) apply(window.SinNotasSafeArea.getInsets());",
  "      })();",
  '    """.trimIndent()',
  "  }",
  "",
].join("\n");

const insertAt = classDeclaration.index + classDeclaration[0].length;
source = source.slice(0, insertAt) + members + source.slice(insertAt);
writeFileSync(mainActivityPath, source, "utf8");
console.log(`Parche de safe area aplicado en ${mainActivityPath}`);
