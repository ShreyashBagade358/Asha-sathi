#!/usr/bin/env python3
"""Generate faithful React TSX components from Stitch AI HTML screens."""
import html
import os
import re
import sys
from html.parser import HTMLParser

SRC = "/Users/shreyash/Downloads/asha-sathi/stitch_ui"
OUT = "/Users/shreyash/Downloads/asha-sathi/apps/web-dashboard/src/pages/stitch"

THEME = {
    "colors.secondary": "#006e28",
    "colors.primary-container": "#005eb8",
    "colors.error": "#ba1a1a",
    "colors.surface-container-high": "#dfe8ff",
    "colors.surface-container-lowest": "#ffffff",
    "colors.surface-container-low": "#f0f3ff",
    "colors.surface": "#f9f9ff",
    "colors.outline": "#727783",
    "colors.outline-variant": "#c2c6d4",
    "borderRadius.full": "9999px",
}

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}

RENAME = {
    "class": "className",
    "for": "htmlFor",
    "colspan": "colSpan",
    "rowspan": "rowSpan",
    "tabindex": "tabIndex",
    "readonly": "readOnly",
    "maxlength": "maxLength",
    "autocomplete": "autoComplete",
    "autofocus": "autoFocus",
    "autoplay": "autoPlay",
    "datetime": "dateTime",
    "contenteditable": "contentEditable",
}

CSS_TO_JS = {
    "font-variation-settings": "fontVariationSettings",
    "font-size": "fontSize",
    "font-family": "fontFamily",
    "font-weight": "fontWeight",
    "line-height": "lineHeight",
    "letter-spacing": "letterSpacing",
    "background-color": "backgroundColor",
    "background-image": "backgroundImage",
    "background-size": "backgroundSize",
    "background": "background",
    "border-radius": "borderRadius",
    "border-color": "borderColor",
    "border-top-color": "borderTopColor",
    "border-bottom-color": "borderBottomColor",
    "border-left-color": "borderLeftColor",
    "border-right-color": "borderRightColor",
    "margin-top": "marginTop",
    "margin-bottom": "marginBottom",
    "padding-bottom": "paddingBottom",
    "padding-top": "paddingTop",
    "padding-left": "paddingLeft",
    "padding-right": "paddingRight",
    "text-align": "textAlign",
    "text-decoration": "textDecoration",
    "text-transform": "textTransform",
    "z-index": "zIndex",
    "max-height": "maxHeight",
    "max-width": "maxWidth",
    "min-height": "minHeight",
    "min-width": "minWidth",
    "overflow-y": "overflowY",
    "overflow-x": "overflowX",
    "transform": "transform",
    "transform-origin": "transformOrigin",
    "transition": "transition",
    "animation": "animation",
    "animation-delay": "animationDelay",
    "animation-duration": "animationDuration",
    "animation-iteration-count": "animationIterationCount",
    "flex-direction": "flexDirection",
    "flex-wrap": "flexWrap",
    "justify-content": "justifyContent",
    "align-items": "alignItems",
    "align-content": "alignContent",
    "align-self": "alignSelf",
    "box-shadow": "boxShadow",
    "opacity": "opacity",
    "filter": "filter",
    "backdrop-filter": "backdropFilter",
    "pointer-events": "pointerEvents",
    "object-fit": "objectFit",
    "grid-template-columns": "gridTemplateColumns",
    "grid-column": "gridColumn",
    "grid-column-start": "gridColumnStart",
    "grid-column-end": "gridColumnEnd",
    "grid-row": "gridRow",
    "gap": "gap",
    "display": "display",
    "position": "position",
    "top": "top",
    "left": "left",
    "right": "right",
    "bottom": "bottom",
    "width": "width",
    "height": "height",
    "color": "color",
    "padding": "padding",
    "margin": "margin",
    "cursor": "cursor",
    "overflow": "overflow",
    "white-space": "whiteSpace",
    "user-select": "userSelect",
    "text-overflow": "textOverflow",
    "clip-path": "clipPath",
    "stroke": "stroke",
    "stroke-width": "strokeWidth",
    "stroke-dasharray": "strokeDasharray",
    "stroke-linecap": "strokeLinecap",
    "stroke-linejoin": "strokeLinejoin",
    "fill": "fill",
    "fill-opacity": "fillOpacity",
    "stop-color": "stopColor",
    "flex": "flex",
    "flex-grow": "flexGrow",
    "flex-shrink": "flexShrink",
    "border": "border",
    "border-bottom": "borderBottom",
    "border-top": "borderTop",
    "border-right": "borderRight",
    "writing-mode": "writingMode",
    "box-sizing": "boxSizing",
    "mix-blend-mode": "mixBlendMode",
    "outline": "outline",
    "font-style": "fontStyle",
    "font-variant": "fontVariant",
    "vertical-align": "verticalAlign",
    "margin-right": "marginRight",
    "margin-left": "marginLeft",
    "float": "float",
    "list-style": "listStyle",
}


def to_camel(key):
    return CSS_TO_JS.get(key, re.sub(r"-([a-z])", lambda m: m.group(1).upper(), key))


def replace_theme(val):
    for k, v in THEME.items():
        val = val.replace(f"theme('{k}')", v)
    return val


def parse_style(style_str):
    style_str = replace_theme(style_str)
    props = []
    for part in style_str.split(";"):
        part = part.strip()
        if not part or ":" not in part:
            continue
        key, _, value = part.partition(":")
        key = key.strip()
        value = value.strip()
        props.append(f"{to_camel(key)}: '{value.replace(chr(39), chr(92) + chr(39))}'")
    return "{ " + ", ".join(props) + " }"


class Converter(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.in_body = False

    def handle_starttag(self, tag, attrs):
        if tag == "body":
            self.in_body = True
            return
        if not self.in_body:
            return
        a = []
        style_obj = None
        for k, v in attrs:
            k = RENAME.get(k, k)
            if v is None:
                a.append((k, True))
            elif k == "style":
                style_obj = v
            else:
                a.append((k, v))
        parts = []
        for k, v in a:
            if v is True:
                parts.append(f" {k}")
            else:
                parts.append(f' {k}="{html.escape(v, quote=True)}"')
        if style_obj is not None:
            parts.append(f" style={{{parse_style(style_obj)}}}")
        if tag in VOID:
            self.out.append(f"<{tag}{''.join(parts)} />")
        else:
            self.out.append(f"<{tag}{''.join(parts)}>")

    def handle_endtag(self, tag):
        if tag == "body":
            self.in_body = False
            return
        if not self.in_body:
            return
        if tag not in VOID:
            self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if self.in_body and data.strip():
            out = data
            out = out.replace("{", "{'{'}")
            out = out.replace("}", "{'}'}")
            out = out.replace("<", "{'<'}")
            out = out.replace(">", "{'>'}")
            self.out.append(out)
    def handle_comment(self, data):
        if self.in_body and data.strip():
            self.out.append("\n")


def convert_one(name):
    src = os.path.join(SRC, name, "code.html")
    with open(src, encoding="utf-8") as f:
        content = f.read()
    m = re.search(r"<title>(.*?)</title>", content, re.S)
    title = m.group(1).strip() if m else name
    body_match = re.search(r"(<body[^>]*>.*?</body>)", content, re.S)
    if not body_match:
        raise ValueError(f"no body in {name}")
    body = body_match.group(1)
    body = re.sub(r"<style[^>]*>.*?</style>", "", body, flags=re.S)
    body = re.sub(r"<script[^>]*>.*?</script>", "", body, flags=re.S)
    c = Converter()
    c.feed(body)
    jsx = "".join(c.out)
    jsx = re.sub(r"\n\s*\n+", "\n\n", jsx).strip()
    return title, jsx


def to_tsx_name(name):
    parts = re.sub(r"[_-]+", "_", name).split("_")
    return "".join(p.title() for p in parts if p)


def generate(name):
    title, jsx = convert_one(name)
    comp = to_tsx_name(name)
    # strip outermost wrapper div? keep as-is; React needs single root. Body content has multiple roots? Usually one root div.
    template = f"""export default function {comp}() {{
  return (
    <>
{jsx}
    </>
  )
}}
"""
    return comp, template


def main():
    os.makedirs(OUT, exist_ok=True)
    dirs = sorted(
        [
            d
            for d in os.listdir(SRC)
            if os.path.isdir(os.path.join(SRC, d)) and os.path.exists(os.path.join(SRC, d, "code.html"))
        ]
    )
    for d in dirs:
        comp, template = generate(d)
        path = os.path.join(OUT, f"{comp}.tsx")
        with open(path, "w", encoding="utf-8") as f:
            f.write(template)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
