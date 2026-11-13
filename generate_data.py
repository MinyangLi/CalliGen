#!/usr/bin/env python3
"""
生成配对样本：
 - data/real_samples/{CHAR}.png   # 白底黑字 渲染自指定 TTF
 - data/skeleton/{CHAR}_skeleton.png       # 单像素 skeleton（白底黑线）
 - data/skeleton/{CHAR}_skeleton_dilated_k{K}.png  # 膨胀后的 skeleton（统一笔宽，白底黑线）

用法:
    python generate_data.py

依赖:
    pip install pillow numpy scikit-image opencv-python
"""
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from skimage.morphology import skeletonize
import cv2
import json

# ========== 配置 ==========
FONT_PATH = os.environ.get("CALLIGEN_FONT_PATH", "")
DATA_DIR = Path(os.environ.get("CALLIGEN_DATA_DIR", "data"))
OUT_REAL_DIR = DATA_DIR / "real_samples"
OUT_SKEL_DIR = DATA_DIR / "skeleton"
json_filepath = Path(__file__).with_name("unique_chars.json")

IMG_SIZE = 1024      # 画布尺寸（正方形）
FONT_SIZE = 800      # 字体大小（点数）
PADDING = 8          # 额外留白（未被显式使用，但保留）

# skeleton dilate（把单像素 skeleton 扩粗到统一笔宽）
# 训练和推理默认使用 kernel_size = 3。
DILATE_KERNEL_SIZE = 3

# ========== 渲染函数 ==========
def render_char_to_image(font_path, char, size=IMG_SIZE, font_size=FONT_SIZE):
    """
    渲染单字为灰度图（白底黑字），返回 numpy.uint8 array
    使用 ImageDraw.textbbox 保证在各种 Pillow 版本中更可靠的居中。
    """
    img = Image.new("L", (size, size), 255)  # white background
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype(font_path, font_size)
    except OSError as e:
        raise RuntimeError(f"无法加载字体文件 '{font_path}': {e}")
    # 计算 bounding box 并居中绘制
    bbox = draw.textbbox((0, 0), char, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (size - w) / 2 - bbox[0]
    y = (size - h) / 2 - bbox[1]
    draw.text((x, y), char, font=font, fill=0)  # black text
    return np.array(img, dtype=np.uint8)

# ========== skeletonize ==========
def make_skeleton_from_bitmap(img_arr):
    """
    输入：灰度图 numpy uint8 (0 black, 255 white)
    输出：skeleton uint8 (white background 255, black skeleton 0)
    """
    bw = (img_arr < 128).astype(np.uint8)  # foreground=1
    sk = skeletonize(bw).astype(np.uint8)  # 0/1 skeleton=1
    # sk==1 表示骨架像素，这里我们希望保存为黑线(0)在白底(255)
    sk_img = np.where(sk > 0, 0, 255).astype(np.uint8)
    return sk_img

def dilate_mask_to_black_strokes(sk_img, kernel_size=3):
    """
    输入 sk_img: 白底黑线 (0=stroke,255=bg)
    先把 stroke 部分变成 255 前景以便 cv2.dilate，再把结果反转回 白底黑线
    返回: 白底黑线 uint8
    """
    if kernel_size <= 1:
        return sk_img
    # 将黑线(0) -> 255 前景，以做膨胀
    foreground = ((sk_img == 0).astype(np.uint8)) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    dilated = cv2.dilate(foreground, kernel, iterations=1)  # dilated: 255 on stroke regions
    # 反转回 白底黑线： dilated>0 -> stroke -> 0 ; else -> 255
    out = np.where(dilated > 0, 0, 255).astype(np.uint8)
    return out

# ========== 主流程 ==========
def main():
    if not FONT_PATH:
        raise ValueError("Set CALLIGEN_FONT_PATH to your TTF/OTF font file.")
    with open(json_filepath, 'r', encoding='utf-8') as f:
        chars = json.load(f)
    OUT_REAL_DIR.mkdir(parents=True, exist_ok=True)
    OUT_SKEL_DIR.mkdir(parents=True, exist_ok=True)
    print("开始生成样本...")
    for ch in chars:
        try:
            rendered = render_char_to_image(FONT_PATH, ch)
        except RuntimeError as e:
            print("ERROR:", e)
            print("请检查 FONT_PATH 是否正确，以及字体文件是否存在并为有效的 TTF/OTF。")
            return

        # 保存渲染图 (白底黑字)
        out_real_path = OUT_REAL_DIR / f"{ch}.png"
        Image.fromarray(rendered).save(out_real_path)
        print("Saved:", out_real_path)

        # 生成 skeleton（单像素，白底黑线）
        sk = make_skeleton_from_bitmap(rendered)
        out_skel_path = OUT_SKEL_DIR / f"{ch}_skeleton.png"
        Image.fromarray(sk).save(out_skel_path)
        print("Saved:", out_skel_path)

        # 生成膨胀后的 skeleton（统一笔宽，白底黑线）
        sk_dil = dilate_mask_to_black_strokes(sk, kernel_size=DILATE_KERNEL_SIZE)
        out_skel_dil_path = OUT_SKEL_DIR / f"{ch}_skeleton_dilated_k{DILATE_KERNEL_SIZE}.png"
        Image.fromarray(sk_dil).save(out_skel_dil_path)
        print("Saved:", out_skel_dil_path)

    print("全部完成。目录结构如下：")
    print(" -", OUT_REAL_DIR.resolve())
    print(" -", OUT_SKEL_DIR.resolve())

if __name__ == "__main__":
    main()
