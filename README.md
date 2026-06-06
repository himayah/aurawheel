# AuraWheel 🎡

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![HTML5](https://img.shields.io/badge/HTML5-CSS3-orange.svg)](#)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow.svg)](#)

A sleek, interactive, and rotating color wheel and picker application designed with modern glassmorphism aesthetics. AuraWheel allows you to explore color spectrums, pick precise colors, and copy values in HEX, RGB, or HSL formats—all while the wheel rotates smoothly.

[日本語の案内はこちら](#日本語)

---

## 🌟 Key Features

* **Fluid Auto-Rotation**: Control the movement with Play/Pause and rotation direction (Clockwise / Counter-Clockwise).
* **Variable Speed Control**: Fine-tune the rotation speed dynamically from `0.0x` (fully stopped) up to `5.0x` speed.
* **Dual Rendering Modes**:
  * **Smooth Spectrum**: A seamless, continuous HSL gradient spectrum wheel.
  * **Segmented Palette**: A structured 24-color hue wheel divided into 5 radial rings of saturation and lightness, mimicking professional art palettes.
* **Advanced Coordinate-Locking Picker**: Clicking or dragging on the rotating wheel locks the pointer onto your selected color. The pointer coordinates rotate along with the wheel in real-time.
* **Polar-Coordinate Snapping**: In segmented mode, the selector pointer automatically snaps to the absolute center of the clicked palette sector.
* **Ambient Aura Backdrop**: Two organic glowing backdrops slowly shift their hues over time, blending with your selected color to create an immersive visual experience.
* **Instant Clipboard Copying**: Easily copy color strings in HEX, RGB, or HSL formats with subtle toast-based UI feedback.

---

## 📸 Demo Preview

*(Add your application screenshots or GIFs here)*

```
[ Your dynamic glassmorphism app preview here ]
```

---

## 📐 Technical Highlights

### 1. High-Performance Canvas Rendering
Instead of using heavy libraries or per-pixel drawing cycles on every frame, AuraWheel draws the HSL color space once on an offscreen/initialization canvas step:
* **Smooth Mode** draws HSL gradient slices at `0.2` degree steps, overlapping slightly to eliminate sub-pixel rendering seams.
* **Segmented Mode** loops over 24 sectors and 5 rings, creating mathematically discrete ring arcs (`ctx.arc`) to form palette cells.

All subsequent rotations are computed via hardware-accelerated CSS 3D transforms (`transform: rotate(deg)`), maintaining a buttery smooth **60 FPS** experience.

### 2. Rotational Polar Coordinate Math
To track exactly which color is under the pointer while the wheel is spinning, the absolute screen coordinates `(dx, dy)` from the center of the wheel are converted into **local polar coordinates**:

$$\theta_{\text{absolute}} = \operatorname{atan2}(dy, dx)$$
$$\theta_{\text{local}} = (\theta_{\text{absolute}} - \theta_{\text{rotation}}) \pmod{360}$$
$$r_{\text{ratio}} = \frac{\sqrt{dx^2 + dy^2}}{R_{\text{css}}}$$

The local values $r_{\text{ratio}}$ and $\theta_{\text{local}}$ are saved as state. Because the pointer element is nested inside the rotating CSS container, storing coordinates in this normalized polar format ensures:
* The pointer **automatically rotates** with the wheel.
* The selection is **100% responsive** to browser window resizes.

---

## 📂 Project Structure

```bash
├── index.html   # Main application structure & SEO meta tags
├── style.css    # CSS Variables, Animations, Custom Range Sliders & Glassmorphism styles
├── app.js       # Core Canvas math, Polar coordinates calculations & Event loops
└── README.md    # Repository documentation
```

---

## 🚀 Quick Start

Since AuraWheel is written in pure vanilla HTML, CSS, and JavaScript, it does not require complex npm build chains.

### Method 1: Double-Click (Simple)
Simply clone the repository and open `index.html` in any modern web browser:
```bash
git clone https://github.com/your-username/aurawheel.git
cd aurawheel
open index.html
```

### Method 2: Local HTTP Server (Recommended)
To run it on a local web server (useful for testing on local network devices or phones):
```bash
# Using Python
python3 -m http.server 8080

# Using Node.js (npx)
npx http-server -p 8080
```
Then, open your browser and navigate to `http://localhost:8080`.

---

## 🌐 Browser Compatibility

AuraWheel utilizes modern web features including CSS Custom Properties, backdrop-filters, flexbox/grid layouts, HSL color support, and the Clipboard API.
* Google Chrome (88+)
* Apple Safari (14.5+)
* Mozilla Firefox (103+)
* Microsoft Edge (88+)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div id="日本語"></div>

## 🇯🇵 日本語ガイド

AuraWheelは、美しく回転するカラーホイールと、その回転に合わせて動くインタラクティブなカラーピッカーです。

### 主な機能
* **滑らかな回転制御**: 再生・一時停止、回転方向の反転、および速度スライダー (0.0x〜5.0x)。
* **2つのデザイン**: シームレスなスペクトルが得られる「スムーズ」モードと、24色相×5階調にスナップする「セグメント」モード。
* **極座標を用いたポインター制御**: カラーホイールが回転していても、選択したカラー位置にポインターが吸着し、一緒に回転します。
* **ワンクリックコピー**: HEX, RGB, HSLコードのクリップボードへのコピーと、トースト通知。

### 起動方法
リポジトリをクローンし、`index.html` をブラウザで直接開くか、またはローカルサーバー（Pythonの `python3 -m http.server 8080` など）を起動してブラウザからアクセスしてください。
