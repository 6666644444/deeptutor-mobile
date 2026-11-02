package org.deeptutormobile.document

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.view.MotionEvent
import android.view.GestureDetector
import android.view.ScaleGestureDetector
import android.widget.ImageView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView
import expo.modules.kotlin.viewevent.EventDispatcher
import java.io.File
import java.util.concurrent.Executors

class LearningDocumentModule: Module() {
  override fun definition() = ModuleDefinition {
    Name("LearningDocument")
    View(LearningDocumentView::class) {
      Events("onDocumentState")
      Prop("uri") { view: LearningDocumentView, value: String -> view.source=value;view.render() }
      Prop("page") { view: LearningDocumentView, value: Int -> view.page=value;view.render() }
    }
  }
}
class LearningDocumentView(context: Context, appContext: AppContext): ExpoView(context,appContext) {
  var source="";var page=1
  private val onDocumentState by EventDispatcher()
  private var worker=Executors.newSingleThreadExecutor()
  private var generation=0
  private var bitmap:Bitmap?=null
  private var scale=1f;private var lastX=0f;private var lastY=0f
  private val image=ImageView(context).apply { scaleType=ImageView.ScaleType.FIT_CENTER;setBackgroundColor(Color.WHITE) }
  private val pinch=ScaleGestureDetector(context,object:ScaleGestureDetector.SimpleOnScaleGestureListener(){
    override fun onScale(detector:ScaleGestureDetector):Boolean {scale=(scale*detector.scaleFactor).coerceIn(1f,5f);image.scaleX=scale;image.scaleY=scale;return true}
  })
  private val taps=GestureDetector(context,object:GestureDetector.SimpleOnGestureListener(){
    override fun onDown(event:MotionEvent)=true
    override fun onDoubleTap(event:MotionEvent):Boolean {scale=if(scale>1f)1f else 2f;image.scaleX=scale;image.scaleY=scale;image.translationX=0f;image.translationY=0f;return true}
  })
  init { addView(image,LayoutParams(LayoutParams.MATCH_PARENT,LayoutParams.MATCH_PARENT));clipChildren=true
    image.setOnTouchListener { _, event ->
      pinch.onTouchEvent(event)
      taps.onTouchEvent(event)
      when(event.actionMasked){
        MotionEvent.ACTION_DOWN -> {lastX=event.x;lastY=event.y;parent?.requestDisallowInterceptTouchEvent(true)}
        MotionEvent.ACTION_MOVE -> if(!pinch.isInProgress&&scale>1){image.translationX+=(event.x-lastX);image.translationY+=(event.y-lastY);lastX=event.x;lastY=event.y}
        MotionEvent.ACTION_UP,MotionEvent.ACTION_CANCEL -> {if(scale<=1){image.translationX=0f;image.translationY=0f};parent?.requestDisallowInterceptTouchEvent(false);image.performClick()}
      };true
    }
  }
  override fun onLayout(changed:Boolean,l:Int,t:Int,r:Int,b:Int){super.onLayout(changed,l,t,r,b);image.layout(0,0,r-l,b-t);if(changed)render()}
  fun render(){
    val seq=++generation;val uri=source;val index=page-1
    if(uri.isBlank()||width==0||worker.isShutdown)return
    val targetWidth=(width*2).coerceIn(600,2400)
    worker.execute {
      try {
        val file=File(Uri.parse(uri).path ?: "")
        require(file.canonicalPath.startsWith(context.cacheDir.canonicalPath+File.separator))
        val result=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY).use { fd ->
          PdfRenderer(fd).use { pdf ->
            require(index in 0 until pdf.pageCount)
            pdf.openPage(index).use { sheet ->
              val height=(targetWidth.toDouble()*sheet.height/sheet.width).toInt().coerceIn(1,4800)
              val output=Bitmap.createBitmap(targetWidth,height,Bitmap.Config.ARGB_8888)
              output.eraseColor(Color.WHITE);sheet.render(output,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
              Pair(output,pdf.pageCount)
            }
          }
        }
        post { if(seq!=generation){result.first.recycle()}else{image.setImageBitmap(result.first);bitmap?.recycle();bitmap=result.first;scale=1f;image.scaleX=1f;image.scaleY=1f;image.translationX=0f;image.translationY=0f;onDocumentState(mapOf("pages" to result.second,"page" to page,"error" to ""))} }
      }catch(e:Exception){post{if(seq==generation)onDocumentState(mapOf("error" to "文档无法显示，请切换文字阅读或重新加载。"))}}
    }
  }
  override fun onAttachedToWindow(){super.onAttachedToWindow();if(worker.isShutdown)worker=Executors.newSingleThreadExecutor();render()}
  override fun onDetachedFromWindow(){generation++;worker.shutdownNow();image.setImageDrawable(null);bitmap?.recycle();bitmap=null;super.onDetachedFromWindow()}
}
