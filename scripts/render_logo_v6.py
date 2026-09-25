# 다시 그리기: python scripts/render_logo_v6.py .   (저장소 맨 위에서)
# 공간마켓 로고 v6(민트 지붕) 래스터 — 1024 그리드 도형을 PIL 로 직접 그린다(SVG 렌더러가 없어서).
import re, math, sys
from PIL import Image, ImageDraw
BG, FIG, ROOF, DOOR = "#0E2B1D", "#FFFFFF", "#8FDDB6", "#E8BD62"
BODY_L = "M245 585 L303 585 L345 528 Q396 486 447 538 L447 730 L300 730 Q245 730 245 675 Z"
BODY_R = "M779 585 L721 585 L679 528 Q630 488 574 540 L609 562 L612 730 L724 730 Q779 730 779 675 Z"
DOOR_P = "M491 507 L558 546 Q566 551 566 561 L566 671 Q566 680 558 685 L492 725 Q481 731 481 719 L481 517 Q481 502 491 507 Z"
ROOF_PTS = [(274,590),(274,410),(512,250),(750,410),(750,590)]

def flatten(d):
    toks = re.findall(r"[MLHVQZ]|-?\d+(?:\.\d+)?", d); pts=[]; i=0; cur=(0,0); cmd=None
    while i < len(toks):
        t=toks[i]
        if t.isalpha(): cmd=t; i+=1
        if cmd=="Z": break
        if cmd in "ML": cur=(float(toks[i]),float(toks[i+1])); i+=2; pts.append(cur)
        elif cmd=="H": cur=(float(toks[i]),cur[1]); i+=1; pts.append(cur)
        elif cmd=="V": cur=(cur[0],float(toks[i])); i+=1; pts.append(cur)
        elif cmd=="Q":
            c=(float(toks[i]),float(toks[i+1])); e=(float(toks[i+2]),float(toks[i+3])); i+=4; p0=cur
            for k in range(1,25):
                u=k/24; pts.append(((1-u)**2*p0[0]+2*(1-u)*u*c[0]+u*u*e[0], (1-u)**2*p0[1]+2*(1-u)*u*c[1]+u*u*e[1]))
            cur=e
    return pts

def render(size, mode="rounded"):
    """mode: rounded(둥근 판·투명 모서리) | square(꽉 찬 판) | maskable(꽉 찬 판·마크 0.9) | circle(원 판·마크 0.9)"""
    S=2048; k=S/1024
    im=Image.new("RGBA",(S,S),(0,0,0,0)); dr=ImageDraw.Draw(im)
    if mode=="rounded": dr.rounded_rectangle([0,0,S-1,S-1], radius=230*k, fill=BG)
    elif mode=="circle": dr.ellipse([0,0,S-1,S-1], fill=BG)
    else: dr.rectangle([0,0,S,S], fill=BG)
    sc = 0.9 if mode in ("maskable","circle") else 1.0
    cy = 475 if sc!=1.0 else 512
    T=lambda p: ((512+(p[0]-512)*sc)*k, (512+(p[1]-cy)*sc)*k)
    # 지붕 — 두께 58, 끝은 잘린 끝(butt), 꺾이는 곳은 둥글게
    w=58*sc*k/2
    for a,b in zip(ROOF_PTS, ROOF_PTS[1:]):
        A,B=T(a),T(b); dx,dy=B[0]-A[0],B[1]-A[1]; L=math.hypot(dx,dy); nx,ny=-dy/L*w,dx/L*w
        dr.polygon([(A[0]+nx,A[1]+ny),(B[0]+nx,B[1]+ny),(B[0]-nx,B[1]-ny),(A[0]-nx,A[1]-ny)], fill=ROOF)
    for p in ROOF_PTS[1:-1]:
        P=T(p); dr.ellipse([P[0]-w,P[1]-w,P[0]+w,P[1]+w], fill=ROOF)
    for d in (BODY_L, BODY_R): dr.polygon([T(p) for p in flatten(d)], fill=FIG)
    for cx in (396,628):
        C=T((cx,455)); r=41*sc*k; dr.ellipse([C[0]-r,C[1]-r,C[0]+r,C[1]+r], fill=FIG)
    dr.polygon([T(p) for p in flatten(DOOR_P)], fill=DOOR)
    return im.resize((size,size), Image.LANCZOS)

if __name__=="__main__":
    out=sys.argv[1]; R=out
    jobs=[("public/icons/icon-1024-v6.png",1024,"rounded",True),("public/icons/icon-512-v6.png",512,"rounded",True),
          ("public/icons/icon-192-v6.png",192,"rounded",True),("public/favicon-v6.png",64,"rounded",True),
          ("public/icons/icon-maskable-512-v6.png",512,"maskable",True),("public/apple-touch-icon-v6.png",180,"square",False),
          ("public/icons/gm-icon-v6-ios-1024.png",1024,"square",False)]
    A="android-twa/app/src/main/res/mipmap-"
    for d,n in [("mdpi",48),("hdpi",72),("xhdpi",96),("xxhdpi",144),("xxxhdpi",192)]:
        jobs += [(f"{A}{d}/ic_launcher.png",n,"rounded",True),(f"{A}{d}/ic_launcher_round.png",n,"circle",True)]
    for path,n,mode,alpha in jobs:
        im=render(n,mode)
        (im if alpha else im.convert("RGB")).save(f"{R}/{path}", optimize=True); print(path,n,mode)
