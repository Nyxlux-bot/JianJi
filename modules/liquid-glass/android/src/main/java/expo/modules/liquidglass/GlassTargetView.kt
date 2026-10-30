package expo.modules.liquidglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.RenderNode
import android.os.Build
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.lang.ref.WeakReference

/**
 * 被折射的内容：把子视图录进一个 RenderNode，玻璃再拿这个节点去画。
 * 玻璃不能放在它里面，否则玻璃会画到自己。
 */
class GlassTargetView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val node: RenderNode? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) RenderNode("LiquidGlassTarget") else null

  var targetId: String? = null
    set(value) {
      field?.let { if (targets[it]?.get() === this) targets.remove(it) }
      field = value
      value?.let { targets[it] = WeakReference(this) }
    }

  // ExpoView 是 LinearLayout，Android 一重新布局就会把子视图横着排开，页面被挤出屏幕；位置交给 RN
  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) = Unit

  override fun dispatchDraw(canvas: Canvas) {
    val node = node
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || node == null || !canvas.isHardwareAccelerated) {
      super.dispatchDraw(canvas)
      return
    }
    node.setPosition(0, 0, width, height)
    val recording = node.beginRecording(width, height)
    try {
      super.dispatchDraw(recording)
    } finally {
      node.endRecording()
    }
    canvas.drawRenderNode(node)
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) node?.discardDisplayList()
  }

  companion object {
    val targets = HashMap<String, WeakReference<GlassTargetView>>()
  }
}
