package org.deeptutormobile.sharefixture;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public class FixtureProvider extends ContentProvider {
  public boolean onCreate(){
    try {
      for(String suffix:new String[]{"a","b","c"}){
        File f=new File(getContext().getFilesDir(),"share-test-"+suffix+".txt");
        try(FileOutputStream out=new FileOutputStream(f)){out.write(("DeepTutor share acceptance fixture "+suffix+". Not a child's learning material.\n").getBytes(StandardCharsets.UTF_8));}
      }
      try(java.io.RandomAccessFile f=new java.io.RandomAccessFile(new File(getContext().getFilesDir(),"oversize.txt"),"rw")){f.setLength(26L*1024*1024);}
      return true;
    }catch(Exception e){return false;}
  }
  private File file(Uri uri){
    String name=uri.getLastPathSegment();
    if(!"share-test-a.txt".equals(name)&&!"share-test-b.txt".equals(name)&&!"share-test-c.txt".equals(name)&&!"oversize.txt".equals(name))throw new IllegalArgumentException();
    return new File(getContext().getFilesDir(),name);
  }
  public Cursor query(Uri uri,String[] columns,String s,String[] args,String order){
    File f=file(uri);String[] c=columns==null?new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE}:columns;
    MatrixCursor cursor=new MatrixCursor(c);Object[] values=new Object[c.length];
    for(int i=0;i<c.length;i++)values[i]=OpenableColumns.SIZE.equals(c[i])?f.length():f.getName().endsWith("-c.txt")?"分享验收-20261101-中文.txt":f.getName();cursor.addRow(values);return cursor;
  }
  public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{if(!"r".equals(mode))throw new FileNotFoundException();return ParcelFileDescriptor.open(file(uri),ParcelFileDescriptor.MODE_READ_ONLY);}
  public String getType(Uri uri){return "text/plain";}
  public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}
  public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}
  public int update(Uri u,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
}
