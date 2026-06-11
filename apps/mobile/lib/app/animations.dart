import 'package:flutter/material.dart';

import 'theme.dart' show MoraColors;

/// Professional animation kit for Mora Mobile.
///
/// All animations respect [MediaQuery.disableAnimations] (system reduce-motion).
class MoraMotion {
  static const Duration micro = Duration(milliseconds: 180);
  static const Duration short = Duration(milliseconds: 260);
  static const Duration medium = Duration(milliseconds: 420);
  static const Duration long = Duration(milliseconds: 620);

  static const Curve ease = Cubic(0.22, 1, 0.36, 1);
  static const Curve overshoot = Cubic(0.34, 1.56, 0.64, 1);
  static const Curve decelerate = Curves.easeOutCubic;

  /// Stagger delay generator: use in lists/grids.
  static Duration stagger(int index, {Duration base = const Duration(milliseconds: 55)}) =>
      base * index;

  /// Returns true when the user prefers reduced motion.
  static bool isReduced(BuildContext context) =>
      MediaQuery.of(context).disableAnimations;

  /// Returns true when the user prefers reduced motion, when no
  /// BuildContext is available (e.g. inside initState).
  static bool isReducedPlatform() {
    final view = WidgetsBinding.instance.platformDispatcher.implicitView;
    if (view == null) return false;
    final data = MediaQueryData.fromView(view);
    return data.disableAnimations;
  }
}

/// Wraps a child with a staggered fade+slide entry.
/// Optionally adds a lift-on-hover feel for interactive surfaces.
class MoraStaggerIn extends StatefulWidget {
  const MoraStaggerIn({
    super.key,
    required this.index,
    required this.child,
    this.delay,
    this.duration = MoraMotion.medium,
    this.slideFrom = const Offset(0, 0.08),
    this.distance = 24,
  });

  final int index;
  final Widget child;
  final Duration? delay;
  final Duration duration;
  final Offset slideFrom;
  final double distance;

  @override
  State<MoraStaggerIn> createState() => _MoraStaggerInState();
}

class _MoraStaggerInState extends State<MoraStaggerIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;
  late final Animation<Offset> _offset;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _opacity = CurvedAnimation(parent: _controller, curve: MoraMotion.ease);
    _offset = Tween<Offset>(
      begin: Offset(
        widget.slideFrom.dx * widget.distance,
        widget.slideFrom.dy * widget.distance,
      ),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: MoraMotion.decelerate));

    final reduced = MoraMotion.isReducedPlatform();
    final delay = widget.delay ?? MoraMotion.stagger(widget.index);
    if (reduced) {
      _controller.value = 1;
    } else {
      Future.delayed(delay, () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MoraMotion.isReduced(context)) return widget.child;
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _offset, child: widget.child),
    );
  }
}

/// Scales a button on press for tactile feedback.
class MoraPress extends StatefulWidget {
  const MoraPress({
    super.key,
    required this.child,
    this.onTap,
    this.scale = 0.97,
    this.opacity = 0.92,
    this.borderRadius,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  final double opacity;
  final BorderRadius? borderRadius;

  @override
  State<MoraPress> createState() => _MoraPressState();
}

class _MoraPressState extends State<MoraPress> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final reduced = MoraMotion.isReduced(context);
    final radius = widget.borderRadius ?? BorderRadius.circular(22);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: widget.onTap == null ? null : (_) => setState(() => _down = true),
      onTapCancel: widget.onTap == null ? null : () => setState(() => _down = false),
      onTapUp: widget.onTap == null ? null : (_) => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: reduced ? 1 : (_down ? widget.scale : 1),
        duration: MoraMotion.micro,
        curve: MoraMotion.ease,
        child: AnimatedOpacity(
          opacity: reduced ? 1 : (_down ? widget.opacity : 1),
          duration: MoraMotion.micro,
          curve: MoraMotion.ease,
          child: ClipRRect(
            borderRadius: radius,
            child: widget.child,
          ),
        ),
      ),
    );
  }
}

/// Lifts a card on press with subtle shadow growth (used in tappables).
class MoraLift extends StatefulWidget {
  const MoraLift({
    super.key,
    required this.child,
    this.onTap,
    this.borderRadius,
    this.enabled = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final BorderRadius? borderRadius;
  final bool enabled;

  @override
  State<MoraLift> createState() => _MoraLiftState();
}

class _MoraLiftState extends State<MoraLift> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final radius = widget.borderRadius ?? BorderRadius.circular(26);
    final reduced = MoraMotion.isReduced(context);
    return AnimatedContainer(
      duration: MoraMotion.short,
      curve: MoraMotion.ease,
      transform: Matrix4.identity()
        ..translateByDouble(0.0, reduced ? 0 : (_down ? -2 : 0), 0.0, 1.0),
      child: Material(
        color: Colors.transparent,
        borderRadius: radius,
        child: InkWell(
          borderRadius: radius,
          onTap: widget.enabled ? widget.onTap : null,
          onHighlightChanged: widget.enabled
              ? (v) => setState(() => _down = v)
              : null,
          child: widget.child,
        ),
      ),
    );
  }
}

/// A pulsing glow ring around a child (used on CTAs or status indicators).
class MoraPulseGlow extends StatefulWidget {
  const MoraPulseGlow({
    super.key,
    required this.child,
    this.color = MoraColors.cocoa,
    this.radius = 26,
  });

  final Widget child;
  final Color color;
  final double radius;

  @override
  State<MoraPulseGlow> createState() => _MoraPulseGlowState();
}

class _MoraPulseGlowState extends State<MoraPulseGlow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    );
    if (!MoraMotion.isReducedPlatform()) {
      _controller.repeat();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MoraMotion.isReduced(context);
    if (reduced) return widget.child;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            boxShadow: [
              BoxShadow(
                color: widget.color.withValues(alpha: 0.18 + 0.18 * (1 - (t - 0.5).abs() * 2)),
                blurRadius: 18 + 14 * (1 - (t - 0.5).abs() * 2),
                spreadRadius: 0.5,
              ),
            ],
          ),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

/// Floating animation (subtle vertical loop) for decorative badges.
class MoraFloat extends StatefulWidget {
  const MoraFloat({
    super.key,
    required this.child,
    this.amplitude = 6,
    this.duration = const Duration(milliseconds: 4200),
  });

  final Widget child;
  final double amplitude;
  final Duration duration;

  @override
  State<MoraFloat> createState() => _MoraFloatState();
}

class _MoraFloatState extends State<MoraFloat>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    if (!MoraMotion.isReducedPlatform()) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MoraMotion.isReduced(context);
    if (reduced) return widget.child;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = Curves.easeInOut.transform(_controller.value);
        return Transform.translate(
          offset: Offset(0, -widget.amplitude * t),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

/// Shimmer overlay for skeleton placeholders.
class MoraShimmer extends StatefulWidget {
  const MoraShimmer({
    super.key,
    required this.child,
    this.baseColor = const Color(0xFFF0D6E0),
    this.highlightColor = Colors.white,
    this.duration = const Duration(milliseconds: 1500),
  });

  final Widget child;
  final Color baseColor;
  final Color highlightColor;
  final Duration duration;

  @override
  State<MoraShimmer> createState() => _MoraShimmerState();
}

class _MoraShimmerState extends State<MoraShimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration)
      ..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MoraMotion.isReduced(context);
    if (reduced) return widget.child;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            final dx = bounds.width * (_controller.value * 2 - 0.5);
            return LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [
                widget.baseColor,
                widget.highlightColor,
                widget.baseColor,
              ],
              stops: const [0.35, 0.5, 0.65],
              transform: _SlidingGradientTransform(dx),
            ).createShader(bounds);
          },
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

class _SlidingGradientTransform extends GradientTransform {
  const _SlidingGradientTransform(this.dx);
  final double dx;

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) {
    return Matrix4.translationValues(dx, 0, 0);
  }
}

/// Page-level fade+slide entry. Wrap the whole body for premium feel.
class MoraPageEnter extends StatefulWidget {
  const MoraPageEnter({super.key, required this.child});
  final Widget child;

  @override
  State<MoraPageEnter> createState() => _MoraPageEnterState();
}

class _MoraPageEnterState extends State<MoraPageEnter>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _opacity;
  late final Animation<Offset> _offset;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: MoraMotion.medium);
    _opacity = CurvedAnimation(parent: _c, curve: MoraMotion.ease);
    _offset = Tween<Offset>(begin: const Offset(0, 0.04), end: Offset.zero)
        .animate(CurvedAnimation(parent: _c, curve: MoraMotion.decelerate));
    _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MoraMotion.isReduced(context)) return widget.child;
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _offset, child: widget.child),
    );
  }
}

/// Hero-scale entrance for a single highlight element.
class MoraScaleIn extends StatefulWidget {
  const MoraScaleIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = MoraMotion.medium,
  });
  final Widget child;
  final Duration delay;
  final Duration duration;

  @override
  State<MoraScaleIn> createState() => _MoraScaleInState();
}

class _MoraScaleInState extends State<MoraScaleIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: widget.duration);
    _scale = Tween<double>(begin: 0.92, end: 1).animate(
        CurvedAnimation(parent: _c, curve: MoraMotion.overshoot));
    Future.delayed(widget.delay, () {
      if (mounted) _c.forward();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MoraMotion.isReduced(context)) return widget.child;
    return ScaleTransition(scale: _scale, child: widget.child);
  }
}

// MoraColors lives in app/theme.dart. Import it directly when needed.
// Example: `import 'app/theme.dart' show MoraColors;`

