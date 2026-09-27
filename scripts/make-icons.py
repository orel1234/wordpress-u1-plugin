# Generates icons/icon-{16,32,48,128}.png from the panel's own brand tokens:
# dark ground (--u1-bg-base), the --u1-primary → --u1-primary-2 gradient the
# buttons use, and the white bold "u" of .u1-logo. Run: python3 scripts/make-icons.py
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, os

BG      = (21, 22, 31)      # oklch(0.14 0.01 260)
P1      = (122, 90, 245)    # oklch(0.60 0.19 293)
P2      = (198, 90, 217)    # oklch(0.66 0.20 322)
WHITE   = (255, 255, 255)
FONT    = '/System/Library/Fonts/HelveticaNeue.ttc'

def lerp(a, b, t): return tuple(round(a[i] + (b[i]-a[i])*t) for i in range(3))

def render(size):
    S = 8                       # supersample
    W = size * S
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Dark rounded tile
    r = W * 0.22
    d.rounded_rectangle([0, 0, W-1, W-1], radius=r, fill=BG + (255,))
    # Gradient disc, 135deg like --u1-primary-fill
    pad = W * 0.16
    disc = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    px = disc.load()
    x0, y0, x1, y1 = pad, pad, W-pad, W-pad
    cx, cy, rad = W/2, W/2, (W-2*pad)/2
    for y in range(int(y0), int(y1)+1):
        for x in range(int(x0), int(x1)+1):
            if (x-cx)**2 + (y-cy)**2 <= rad*rad:
                t = ((x-x0) + (y-y0)) / (2*(x1-x0))
                px[x, y] = lerp(P1, P2, t) + (255,)
    # Soft glow under the disc (--u1-primary-glow)
    glow = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([x0, y0+W*0.04, x1, y1+W*0.04], fill=P1 + (110,))
    glow = glow.filter(ImageFilter.GaussianBlur(W*0.05))
    img.alpha_composite(glow)
    img.alpha_composite(disc)
    # The "u", bold, optically centred
    font = ImageFont.truetype(FONT, int(W*0.50), index=1)   # index 1 = Bold face
    bbox = d.textbbox((0, 0), 'u', font=font)
    tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    d = ImageDraw.Draw(img)
    d.text((cx - tw/2 - bbox[0], cy - th/2 - bbox[1] - W*0.01), 'u', font=font, fill=WHITE + (255,))
    return img.resize((size, size), Image.LANCZOS)

os.makedirs('icons', exist_ok=True)
for s in (16, 32, 48, 128):
    render(s).save(f'icons/icon-{s}.png')
    print('wrote icons/icon-%d.png' % s)
