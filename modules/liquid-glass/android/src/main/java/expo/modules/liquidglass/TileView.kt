package expo.modules.liquidglass

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.Shader
import android.os.Handler
import android.os.Looper
import android.view.View
import java.net.URL

/**
 * 平铺小图（首页卡面的纸纹）：原图按原像素从左上角铺满，染色同 RN Image 的 tintColor（SRC_IN）。
 * RN 安卓的 resizeMode="repeat" 会给每个视图另生成一张视图大小的整图，还不共享：
 * 四张卡八层纸纹约 30MB 贴图，把首页撑过系统贴图缓存上限。这里同一张原图只解码一次，大家共用。
 */
class TileView(context: Context) : View(context) {
  // 卡片缩放、翘起时按双线性取样，同 RN Image 画位图
  private val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.DITHER_FLAG)
  private var source: String? = null

  init {
    setWillNotDraw(false)
  }

  fun setSource(value: String) {
    if (value == source) return
    source = value
    paint.shader = null
    invalidate()
    load(value)
  }

  fun setTint(color: Int?) {
    paint.colorFilter = color?.let { PorterDuffColorFilter(it, PorterDuff.Mode.SRC_IN) }
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    if (paint.shader != null) canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
  }

  // 按原像素解码，不按屏幕密度缩放，同 RN Image：发布包里图是 drawable 资源，传来资源名；开发时图在 Metro 上
  private fun load(value: String) {
    cache[value]?.let { return show(value, it) }
    val options = BitmapFactory.Options().apply { inScaled = false }
    if (!value.contains("://")) {
      val id = resources.getIdentifier(value, "drawable", context.packageName)
      if (id == 0) return
      BitmapFactory.decodeResource(resources, id, options)?.let {
        cache[value] = it
        show(value, it)
      }
      return
    }
    Thread {
      val bitmap = runCatching { URL(value).openStream().use { BitmapFactory.decodeStream(it, null, options) } }.getOrNull()
      if (bitmap != null) main.post {
        cache[value] = bitmap
        show(value, bitmap)
      }
    }.start()
  }

  private fun show(value: String, bitmap: Bitmap) {
    if (value != source) return
    paint.shader = BitmapShader(bitmap, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
    invalidate()
  }

  companion object {
    // 只在主线程读写
    private val cache = HashMap<String, Bitmap>()
    private val main = Handler(Looper.getMainLooper())
  }
}
