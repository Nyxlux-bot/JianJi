package expo.modules.liquidglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.RuntimeShader
import android.graphics.Shader
import android.os.Build
import android.view.View
import android.view.ViewTreeObserver
import androidx.annotation.RequiresApi

/**
 * 液态玻璃：把 GlassTarget 里正好在自己底下的那一块画进来，交给着色器做凸透镜折射。
 * 边缘一圈往里取像，越靠边越狠；magnify 再整体往中心取，等于放大；红绿蓝三路取像距离略不同，出色散。
 * 尺寸参数都是 dp。
 */
class GlassView(context: Context) : View(context) {
  var targetId: String? = null
  var cornerRadius = 0f
  var refraction = 16f
  var bevel = 22f
  var magnify = 0f
  var dispersion = 0.03f
  var blurRadius = 0.6f

  private val node: RenderNode? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) RenderNode("LiquidGlass") else null
  private val shader: RuntimeShader? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) RuntimeShader(SHADER) else null
  private val toGlobal = Matrix()
  private val fromGlobal = Matrix()
  // 着色器参数没变就沿用上一帧的 RenderEffect：每帧新建会在 UI 线程不断产生垃圾，攒多了 GC 一停就掉帧
  private val effectKey = FloatArray(9)
  private val nextKey = FloatArray(9)
  private var hasEffect = false

  // 底下的页面每帧都可能在动（经幡），每次要画一帧都跟着重画；自己或任一上层透明（没按住时的水泡）就不画
  private val preDraw = ViewTreeObserver.OnPreDrawListener {
    if (isShown && visibleUpward()) invalidate()
    true
  }

  private fun visibleUpward(): Boolean {
    var view: View? = this
    while (view != null) {
      if (view.alpha <= 0f) return false
      view = view.parent as? View
    }
    return true
  }

  init {
    setWillNotDraw(false)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnPreDrawListener(preDraw)
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnPreDrawListener(preDraw)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) node?.discardDisplayList()
    super.onDetachedFromWindow()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) drawGlass(canvas)
  }

  @RequiresApi(Build.VERSION_CODES.TIRAMISU)
  private fun drawGlass(canvas: Canvas) {
    val shader = shader ?: return
    val node = node ?: return
    if (!canvas.isHardwareAccelerated || width == 0 || height == 0) return
    val target = targetId?.let { GlassTargetView.targets[it]?.get() } ?: return
    val source = target.node ?: return
    if (!target.isAttachedToWindow) return

    // 目标的坐标 → 屏幕 → 自己的坐标；自己被缩放、拉伸时底图跟着对齐
    toGlobal.reset()
    target.transformMatrixToGlobal(toGlobal)
    fromGlobal.reset()
    transformMatrixToGlobal(fromGlobal)
    if (!fromGlobal.invert(fromGlobal)) return
    toGlobal.postConcat(fromGlobal)

    node.setPosition(0, 0, width, height)
    val recording = node.beginRecording(width, height)
    try {
      recording.concat(toGlobal)
      recording.drawRenderNode(source)
    } finally {
      node.endRecording()
    }

    val density = resources.displayMetrics.density
    val w = width.toFloat()
    val h = height.toFloat()
    nextKey[0] = w; nextKey[1] = h; nextKey[2] = cornerRadius; nextKey[3] = bevel; nextKey[4] = refraction
    nextKey[5] = magnify; nextKey[6] = dispersion; nextKey[7] = blurRadius; nextKey[8] = density
    if (!hasEffect || !nextKey.contentEquals(effectKey)) {
      nextKey.copyInto(effectKey)
      hasEffect = true
      shader.setFloatUniform("size", w, h)
      shader.setFloatUniform("radius", minOf(cornerRadius * density, w / 2f, h / 2f))
      shader.setFloatUniform("bevel", maxOf(1f, bevel * density))
      shader.setFloatUniform("strength", refraction * density)
      shader.setFloatUniform("magnify", magnify)
      shader.setFloatUniform("dispersion", dispersion)
      val glass = RenderEffect.createRuntimeShaderEffect(shader, "content")
      val blur = blurRadius * density
      node.setRenderEffect(
        if (blur > 0.01f) RenderEffect.createChainEffect(glass, RenderEffect.createBlurEffect(blur, blur, Shader.TileMode.CLAMP))
        else glass
      )
    }
    canvas.drawRenderNode(node)
  }

  companion object {
    // 与设计画布 TabBar.dc.html 的位移贴图同一套算法
    private const val SHADER = """
      uniform shader content;
      uniform float2 size;
      uniform float radius;
      uniform float bevel;
      uniform float strength;
      uniform float magnify;
      uniform float dispersion;

      float sdRound(float2 p, float2 b, float r) {
        float2 q = abs(p) - b + float2(r);
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }

      half4 main(float2 coord) {
        float2 halfSize = size * 0.5;
        float2 p = coord - halfSize;
        float d = sdRound(p, halfSize, radius);
        float coverage = clamp(0.5 - d, 0.0, 1.0);
        if (coverage <= 0.0) return half4(0.0);

        float2 grad = float2(
          sdRound(p + float2(0.5, 0.0), halfSize, radius) - sdRound(p - float2(0.5, 0.0), halfSize, radius),
          sdRound(p + float2(0.0, 0.5), halfSize, radius) - sdRound(p - float2(0.0, 0.5), halfSize, radius));
        float gl = length(grad);
        float2 n = gl > 0.0001 ? grad / gl : float2(0.0);
        float t = clamp(1.0 + d / bevel, 0.0, 1.0);
        float2 off = -n * pow(t, 2.4) - p / halfSize * magnify;
        float ol = length(off);
        if (ol > 1.0) off /= ol;
        off *= strength;

        half4 r = content.eval(coord + off);
        half4 g = content.eval(coord + off * (1.0 + dispersion));
        half4 b = content.eval(coord + off * (1.0 + 2.0 * dispersion));
        half3 c = half3(r.r, g.g, b.b);
        half l = dot(c, half3(0.2126, 0.7152, 0.0722));
        c = mix(half3(l), c, half(1.35));
        return half4(c, r.a) * half(coverage);
      }
    """
  }
}
