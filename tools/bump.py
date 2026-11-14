# Adds/updates ?v=BUILD on every module import, data fetch and stylesheet so browsers never mix old and new files.
# Usage: python3 tools/bump.py 2026-11-15d
import re,sys,glob
V=sys.argv[1]; import os; root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+'/'
files=glob.glob(root+'src/*.js')+[root+'index.html',root+'nasa.html']
pat=[(r"""((?:from|import)\s*\(?\s*['"]\.{1,2}/[\w./-]+\.js)(\?v=[\w.-]+)?(['"])""", r"\1?v="+V+r"\3"),
     (r"""(src=["']src/main\.js)(\?v=[\w.-]+)?(["'])""", r"\1?v="+V+r"\3"),
     (r"""(href=["']src/style\.css)(\?v=[\w.-]+)?(["'])""", r"\1?v="+V+r"\3"),
     (r"""(['"`](?:data/(?!donki_latest)[\w_]+\.json|assets/voice/\$\{l\}/index\.json))(\?v=[\w.-]+)?(['"`])""", r"\1?v="+V+r"\3")]
for f in files:
    s=open(f).read(); o=s
    for a,b in pat: s=re.sub(a,b,s)
    s=re.sub(r"(const BUILD = ')[\w.-]+(';)", r"\g<1>"+V+r"\2", s)
    if s!=o: open(f,'w').write(s); print('updated',f.replace(root,''))
