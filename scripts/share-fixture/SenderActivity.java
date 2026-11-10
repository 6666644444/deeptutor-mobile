package org.deeptutormobile.sharefixture;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.content.ClipData;
import android.net.Uri;
import android.widget.Button;
import android.widget.LinearLayout;
import java.util.ArrayList;

public class SenderActivity extends Activity {
  public void onCreate(Bundle state) {
    super.onCreate(state);
    LinearLayout layout = new LinearLayout(this); layout.setOrientation(1); layout.setPadding(30,100,30,30);
    for (int count : new int[]{1,2,0,3,4}) {
      Button b=new Button(this);
      b.setText(count==1?"分享单个测试文件":count==2?"分享两个测试文件":count==0?"分享云文档链接":count==3?"分享超限测试文件":"用其他应用打开测试文件");
      b.setOnClickListener(new android.view.View.OnClickListener(){public void onClick(android.view.View v){share(count);}}); layout.addView(b);
    }
    setContentView(layout);
  }
  private void share(int count) {
    Intent intent=new Intent(count==2?Intent.ACTION_SEND_MULTIPLE:count==4?Intent.ACTION_VIEW:Intent.ACTION_SEND); intent.setType("text/plain");
    if (count==0) intent.putExtra(Intent.EXTRA_TEXT,"https://example.invalid/cloud-document");
    else {
      ArrayList<Uri> uris=new ArrayList<>();
      uris.add(Uri.parse("content://org.deeptutormobile.sharefixture.files/"+(count==3?"oversize.txt":count==4?"share-test-c.txt":"share-test-a.txt")));
      if(count==2) uris.add(Uri.parse("content://org.deeptutormobile.sharefixture.files/share-test-b.txt"));
      if(count==2) intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM,uris); else intent.putExtra(Intent.EXTRA_STREAM,uris.get(0));
      if(count==4) intent.setDataAndType(uris.get(0),"text/plain");
      ClipData clip=ClipData.newUri(getContentResolver(),"测试资料",uris.get(0));
      if(count==2) clip.addItem(new ClipData.Item(uris.get(1)));
      intent.setClipData(clip); intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    }
    startActivity(Intent.createChooser(intent,"选择接收资料的应用"));
  }
}
