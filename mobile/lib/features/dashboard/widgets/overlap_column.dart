import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

/// Two children stacked vertically where the second overlaps the bottom [overlap] of the first (the summary card
/// riding over the hero's rounded edge). Both are laid out at their real positions, so taps land correctly, and the
/// first child can be any height (it grows with text size) - no guessed hero height.
class OverlapColumn extends MultiChildRenderObjectWidget {
  OverlapColumn({super.key, required this.overlap, required Widget top, required Widget bottom}) : super(children: [top, bottom]);

  final double overlap;

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderOverlapColumn(overlap);

  @override
  void updateRenderObject(BuildContext context, RenderObject renderObject) => (renderObject as _RenderOverlapColumn).overlap = overlap;
}

class _ParentData extends ContainerBoxParentData<RenderBox> {}

class _RenderOverlapColumn extends RenderBox with ContainerRenderObjectMixin<RenderBox, _ParentData>, RenderBoxContainerDefaultsMixin<RenderBox, _ParentData> {
  _RenderOverlapColumn(this._overlap);

  double _overlap;
  set overlap(double v) {
    if (v == _overlap) return;
    _overlap = v;
    markNeedsLayout();
  }

  @override
  void setupParentData(RenderBox child) {
    if (child.parentData is! _ParentData) child.parentData = _ParentData();
  }

  @override
  void performLayout() {
    final inner = BoxConstraints(minWidth: constraints.maxWidth, maxWidth: constraints.maxWidth);
    final top = firstChild!;
    final bottom = childAfter(top)!;
    top.layout(inner, parentUsesSize: true);
    (top.parentData! as _ParentData).offset = Offset.zero;
    bottom.layout(inner, parentUsesSize: true);
    final y = top.size.height - _overlap;
    (bottom.parentData! as _ParentData).offset = Offset(0, y);
    size = constraints.constrain(Size(constraints.maxWidth, y + bottom.size.height));
  }

  @override
  void paint(PaintingContext context, Offset offset) => defaultPaint(context, offset);

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) => defaultHitTestChildren(result, position: position);
}
