package expo.modules.liquidglass

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LiquidGlassModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LiquidGlass")

    // RuntimeShader 要 Android 13
    Constant("supported") { Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU }
    // 有平铺视图的原生包才有这项：新 JS 跑在旧原生包上时退回 RN Image，不至于找不到视图
    Constant("tile") { true }

    View(GlassTargetView::class) {
      Name("GlassTarget")
      Prop("targetId") { view: GlassTargetView, id: String -> view.targetId = id }
    }

    View(GlassView::class) {
      Name("GlassView")
      Prop("targetId") { view: GlassView, id: String -> view.targetId = id; view.invalidate() }
      Prop("cornerRadius") { view: GlassView, value: Float -> view.cornerRadius = value; view.invalidate() }
      Prop("refraction") { view: GlassView, value: Float -> view.refraction = value; view.invalidate() }
      Prop("bevel") { view: GlassView, value: Float -> view.bevel = value; view.invalidate() }
      Prop("magnify") { view: GlassView, value: Float? -> view.magnify = value ?: 0f; view.invalidate() }
      Prop("dispersion") { view: GlassView, value: Float? -> view.dispersion = value ?: 0.03f; view.invalidate() }
      Prop("blurRadius") { view: GlassView, value: Float? -> view.blurRadius = value ?: 0.6f; view.invalidate() }
    }

    View(TileView::class) {
      Name("Tile")
      Prop("source") { view: TileView, uri: String -> view.setSource(uri) }
      Prop("tint") { view: TileView, color: Int? -> view.setTint(color) }
    }
  }
}
