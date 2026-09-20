
import 'package:flutter/material.dart';

/// A subtle animated textile texture: two rows of short slanted strokes that read as S- and Z-twisted plied cord.
/// The S row drifts right and the Z row drifts left; one loop travels exactly two 12px tiles, so it repeats without a jump.
/// It fades out from the top-right corner, sits behind content, never takes taps, and only repaints its own layer.
///
/// Tweak: [speed] (1 = one loop per 10s, 2 = twice as fast), [whiteOpacity] and [accentOpacity], or [accent].
class PliedCordTexture extends StatefulWidget {
  const PliedCordTexture({
    super.key,
    required this.accent,
    this.speed = 1,
    this.paused = false,
    this.whiteOpacity = 0.10,
    this.accentOpacity = 0.18,
  });

  final Color accent;
  final double speed;

  /// Holds the animation still (for example while offline, as a quiet status cue). The texture stays visible.
  final bool paused;
  final double whiteOpacity;
  final double accentOpacity;

  @override
  State<PliedCordTexture> createState() => _PliedCordTextureState();
}

class _PliedCordTextureState extends State<PliedCordTexture> with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _controller = AnimationController(vsync: this, duration: _duration);
  bool _inForeground = true;

  Duration get _duration => Duration(milliseconds: (10000 / widget.speed).round());

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(PliedCordTexture old) {
    super.didUpdateWidget(old);
    if (old.speed != widget.speed) _controller.duration = _duration;
    _sync();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _inForeground = state == AppLifecycleState.resumed;
    _sync();
  }

  /// Runs only while it is visible to the user: not paused, no reduced-motion setting, app in the foreground.
  /// (An off-screen route mutes the ticker by itself through TickerMode, and a scrolled-away hero is disposed.)
  void _sync() {
    final run = !widget.paused && !MediaQuery.disableAnimationsOf(context) && _inForeground && TickerMode.valuesOf(context).enabled;
    if (run && !_controller.isAnimating) {
      _controller.repeat();
    } else if (!run && _controller.isAnimating) {
      _controller.stop();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: RepaintBoundary(
        child: ShaderMask(
          blendMode: BlendMode.dstIn,
          shaderCallback: (bounds) => const RadialGradient(
            center: Alignment.topRight,
            radius: 1,
            colors: [Colors.black, Colors.transparent],
            stops: [0.3, 0.78],
            transform: _Ellipse(),
          ).createShader(bounds),
          child: CustomPaint(
            size: Size.infinite,
            painter: CordPainter(_controller, whiteOpacity: widget.whiteOpacity, accent: widget.accent, accentOpacity: widget.accentOpacity),
          ),
        ),
      ),
    );
  }
}

/// Stretches the fade into an ellipse 130% of the width by 100% of the height, centred on the top-right corner.
class _Ellipse extends GradientTransform {
  const _Ellipse();

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) {
    // A RadialGradient's radius 1 is the shortest side; scale x so the horizontal radius is 1.3 x the width.
    final sx = 1.3 * bounds.width / bounds.shortestSide;
    final sy = bounds.height / bounds.shortestSide;
    return Matrix4.identity()
      ..translateByDouble(bounds.right, bounds.top, 0, 1)
      ..scaleByDouble(sx, sy, 1, 1)
      ..translateByDouble(-bounds.right, -bounds.top, 0, 1);
  }
}

/// Paints the two strands. Public only so a test can check the loop is seamless.
@visibleForTesting
class CordPainter extends CustomPainter {
  CordPainter(this.animation, {required this.whiteOpacity, required this.accent, required this.accentOpacity}) : super(repaint: animation);

  final Animation<double> animation;
  final double whiteOpacity;
  final Color accent;
  final double accentOpacity;

  static const _tileW = 12.0, _tileH = 14.0;
  static const _travel = 2 * _tileW; // two tiles per loop
  static const travel = _travel;
  static const _overscan = _travel + _tileW;

  // One tile: S strokes in the upper half, Z strokes in the lower half.
  static const _s = [(Offset(1, 6), Offset(5, 1)), (Offset(7, 6), Offset(11, 1))];
  static const _z = [(Offset(1, 8), Offset(5, 13)), (Offset(7, 8), Offset(11, 13))];

  Size? _cachedFor;
  Path? _sPath;
  Path? _zPath;

  Path _pattern(List<(Offset, Offset)> strokes, Size size) {
    final path = Path();
    for (var y = 0.0; y < size.height; y += _tileH) {
      for (var x = -_overscan; x < size.width + _overscan; x += _tileW) {
        for (final (a, b) in strokes) {
          path
            ..moveTo(x + a.dx, y + a.dy)
            ..lineTo(x + b.dx, y + b.dy);
        }
      }
    }
    return path;
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (_cachedFor != size) {
      _sPath = _pattern(_s, size);
      _zPath = _pattern(_z, size);
      _cachedFor = size;
    }
    final t = animation.value;
    Paint stroke(Color c) => Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round
      ..color = c;

    canvas.save();
    canvas.translate(_travel * t, 0); // S drifts right
    canvas.drawPath(_sPath!, stroke(Colors.white.withValues(alpha: whiteOpacity)));
    canvas.restore();

    canvas.save();
    canvas.translate(-_travel * t, 0); // Z drifts left
    canvas.drawPath(_zPath!, stroke(accent.withValues(alpha: accentOpacity)));
    canvas.restore();
  }

  @override
  bool shouldRepaint(CordPainter old) => old.whiteOpacity != whiteOpacity || old.accent != accent || old.accentOpacity != accentOpacity || old.animation != animation;
}
