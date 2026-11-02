package org.deeptutormobile.sharing

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.TextView
import android.widget.LinearLayout
import android.widget.Button

class ReceiveShareActivity : Activity() {
  @Volatile private var cancelled = false
  override fun onDestroy() { if (isFinishing) cancelled = true; super.onDestroy() }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL; setPadding(40, 120, 40, 40)
      addView(TextView(this@ReceiveShareActivity).apply { text = "正在接收资料…\n接收后请核对账号，再确认保存。"; textSize = 20f })
      addView(Button(this@ReceiveShareActivity).apply { text = "取消"; setOnClickListener { cancelled = true; finish() } })
    })
    Thread {
      try {
        ShareInbox.receive(applicationContext, intent) { cancelled }
        runOnUiThread {
          if (cancelled || isFinishing || isDestroyed) return@runOnUiThread
          val launch = packageManager.getLaunchIntentForPackage(packageName)
          if (launch != null) {
            launch.action = Intent.ACTION_VIEW
            launch.data = Uri.parse("deeptutor-mobile://share-inbox")
            launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            startActivity(launch)
          }
          finish()
        }
      } catch (_: Exception) {
        runOnUiThread { if (cancelled || isFinishing || isDestroyed) return@runOnUiThread
          AlertDialog.Builder(this).setTitle("暂未接收").setMessage("请先在 DeepTutor 处理已有待接收资料，或在来源 App 下载文件后重试。")
          .setPositiveButton("知道了") { _, _ -> finish() }.setOnCancelListener { finish() }.show() }
      }
    }.start()
  }
}
