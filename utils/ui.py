# utils/ui.py

import streamlit as st
import html


PASTEL_THEME = {
    "primary": "#F9A8D4",
    "primary_dark": "#DB2777",
    "primary_soft": "#FCE7F3",
    "background": "#FFF7FB",
    "lavender": "#DDD6FE",
    "lavender_dark": "#7C3AED",
    "sky": "#BAE6FD",
    "sky_dark": "#0284C7",
    "mint": "#BBF7D0",
    "mint_dark": "#059669",
    "peach": "#FED7AA",
    "peach_dark": "#EA580C",
    "rose": "#FECDD3",
    "rose_dark": "#E11D48",
    "card": "rgba(255,255,255,0.78)",
    "border": "rgba(249,168,212,0.30)",
    "border_soft": "rgba(128,128,128,0.18)",
    "text": "#1F2937",
    "muted": "#6B7280",
    "muted_light": "#9CA3AF",
    "shadow_neutral": "rgba(31,41,55,0.07)",
    "shadow_neutral_hover": "rgba(31,41,55,0.12)",
    "shadow_pink": "rgba(219,39,119,0.10)",
}


def safe(value):
    return html.escape(str(value))


def get_status_style(score):
    if score >= 80:
        return {
            "label": "Strong",
            "color": PASTEL_THEME["mint_dark"],
            "bg": "rgba(187,247,208,0.48)",
            "border": "rgba(5,150,105,0.22)",
        }

    if score >= 60:
        return {
            "label": "Moderate",
            "color": PASTEL_THEME["peach_dark"],
            "bg": "rgba(254,215,170,0.48)",
            "border": "rgba(234,88,12,0.22)",
        }

    return {
        "label": "Needs Attention",
        "color": PASTEL_THEME["rose_dark"],
        "bg": "rgba(254,205,211,0.48)",
        "border": "rgba(225,29,72,0.22)",
    }


def inject_premium_css():
    st.markdown(
        f"""
<style>
:root {{
    --retailai-primary: {PASTEL_THEME["primary"]};
    --retailai-primary-dark: {PASTEL_THEME["primary_dark"]};
    --retailai-primary-soft: {PASTEL_THEME["primary_soft"]};
    --retailai-bg: {PASTEL_THEME["background"]};
    --retailai-text: {PASTEL_THEME["text"]};
    --retailai-muted: {PASTEL_THEME["muted"]};
}}

.block-container {{
    padding-top: 2rem;
    padding-bottom: 3rem;
}}

h1, h2, h3 {{
    color: {PASTEL_THEME["text"]};
    letter-spacing: -0.02em;
}}

hr {{
    border: none;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(249,168,212,0.38), transparent);
    margin: 1.4rem 0;
}}

.premium-card {{
    transition: all 0.25s ease-in-out;
}}

.premium-card:hover {{
    transform: translateY(-3px);
    box-shadow: 0 12px 30px {PASTEL_THEME["shadow_neutral_hover"]} !important;
    border-color: rgba(249,168,212,0.48) !important;
}}

.premium-hero {{
    transition: all 0.25s ease-in-out;
}}

.premium-hero:hover {{
    transform: translateY(-2px);
    box-shadow: 0 14px 34px rgba(31,41,55,0.10) !important;
}}

div.stButton > button,
div.stDownloadButton > button {{
    border-radius: 14px !important;
    border: 1px solid rgba(249,168,212,0.42) !important;
    background: linear-gradient(135deg, rgba(252,231,243,0.82), rgba(255,255,255,0.72)) !important;
    color: {PASTEL_THEME["text"]} !important;
    font-weight: 750 !important;
    transition: all 0.2s ease-in-out !important;
}}

div.stButton > button:hover,
div.stDownloadButton > button:hover {{
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(31,41,55,0.10) !important;
    border-color: rgba(219,39,119,0.36) !important;
}}

section[data-testid="stSidebar"] {{
    background: linear-gradient(180deg, rgba(255,247,251,0.96), rgba(248,250,252,0.96));
}}

section[data-testid="stSidebar"] div[data-testid="stExpander"] details {{
    border-radius: 14px !important;
    border-color: rgba(249,168,212,0.30) !important;
}}

div[data-testid="stDataFrame"] {{
    border-radius: 16px;
    overflow: hidden;
}}

div[data-testid="stAlert"] {{
    border-radius: 16px !important;
}}
</style>
        """,
        unsafe_allow_html=True
    )


def render_kpi_card(title, value, help_text=None):
    card_html = f"""<div class="premium-card" style="padding:18px;border-radius:18px;border:1px solid {PASTEL_THEME["border"]};background:linear-gradient(135deg,rgba(255,255,255,0.84),rgba(252,231,243,0.28));box-shadow:0 8px 22px {PASTEL_THEME["shadow_neutral"]};min-height:125px;margin-bottom:10px;"><div style="font-size:12px;font-weight:800;color:{PASTEL_THEME["primary_dark"]};text-transform:uppercase;margin-bottom:8px;letter-spacing:0.4px;">{safe(title)}</div><div style="font-size:26px;font-weight:850;margin-bottom:6px;line-height:1.25;overflow-wrap:anywhere;color:{PASTEL_THEME["text"]};">{safe(value)}</div><div style="font-size:12px;color:{PASTEL_THEME["muted"]};line-height:1.45;">{safe(help_text) if help_text else ""}</div></div>"""
    st.markdown(card_html, unsafe_allow_html=True)


def render_hero_section(title, subtitle, badge_text, secondary_badge=None):
    secondary_html = ""

    if secondary_badge:
        secondary_html = f"""<span style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(186,230,253,0.56);color:{PASTEL_THEME["sky_dark"]};border:1px solid rgba(2,132,199,0.16);font-size:13px;font-weight:800;margin-left:8px;">{safe(secondary_badge)}</span>"""

    hero_html = f"""<div class="premium-hero" style="padding:30px 32px;border-radius:26px;background:radial-gradient(circle at top left, rgba(249,168,212,0.30), transparent 34%),linear-gradient(135deg,rgba(252,231,243,0.78),rgba(221,214,254,0.34),rgba(255,255,255,0.62));border:1px solid rgba(249,168,212,0.38);box-shadow:0 12px 30px {PASTEL_THEME["shadow_neutral"]};margin-bottom:28px;"><div style="margin-bottom:14px;"><span style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(252,231,243,0.95);color:{PASTEL_THEME["primary_dark"]};border:1px solid rgba(219,39,119,0.16);font-size:13px;font-weight:850;">{safe(badge_text)}</span>{secondary_html}</div><div style="font-size:38px;font-weight:900;line-height:1.12;margin-bottom:10px;color:{PASTEL_THEME["text"]};letter-spacing:-0.03em;">{safe(title)}</div><div style="font-size:16px;color:{PASTEL_THEME["muted"]};line-height:1.65;max-width:940px;">{safe(subtitle)}</div></div>"""
    st.markdown(hero_html, unsafe_allow_html=True)


def render_score_card(title, score, description):
    style = get_status_style(score)

    score_html = f"""<div class="premium-card" style="padding:22px;border-radius:22px;border:1px solid {style["border"]};background:linear-gradient(135deg,{style["bg"]},rgba(255,255,255,0.72));box-shadow:0 8px 22px {PASTEL_THEME["shadow_neutral"]};margin-bottom:18px;"><div style="display:flex;align-items:center;justify-content:space-between;gap:16px;"><div><div style="font-size:13px;color:{PASTEL_THEME["primary_dark"]};font-weight:800;text-transform:uppercase;letter-spacing:0.35px;">{safe(title)}</div><div style="font-size:42px;font-weight:900;line-height:1.1;margin-top:8px;color:{PASTEL_THEME["text"]};">{score}/100</div><div style="font-size:13px;color:{PASTEL_THEME["muted"]};margin-top:8px;line-height:1.45;">{safe(description)}</div></div><div style="padding:10px 14px;border-radius:999px;background:{style["bg"]};color:{style["color"]};border:1px solid {style["border"]};font-size:14px;font-weight:850;white-space:nowrap;">{style["label"]}</div></div></div>"""
    st.markdown(score_html, unsafe_allow_html=True)


def render_insight_card(title, body, icon="💡"):
    insight_html = f"""<div class="premium-card" style="padding:16px 18px;border-radius:18px;border:1px solid {PASTEL_THEME["border"]};background:linear-gradient(135deg,rgba(255,255,255,0.82),rgba(252,231,243,0.24));box-shadow:0 8px 22px {PASTEL_THEME["shadow_neutral"]};min-height:120px;margin-bottom:10px;"><div style="font-size:22px;margin-bottom:8px;">{safe(icon)}</div><div style="font-size:15px;font-weight:850;margin-bottom:6px;color:{PASTEL_THEME["text"]};">{safe(title)}</div><div style="font-size:13px;color:{PASTEL_THEME["muted"]};line-height:1.55;white-space:pre-line;">{safe(body)}</div></div>"""
    st.markdown(insight_html, unsafe_allow_html=True)


# ============================================================
# RetailAI Chart + Empty State Helpers
# ============================================================

CHART_COLOR_SEQUENCE = [
    PASTEL_THEME["primary"],
    PASTEL_THEME["lavender"],
    PASTEL_THEME["mint"],
    PASTEL_THEME["sky"],
    PASTEL_THEME["peach"],
    PASTEL_THEME["rose"],
    "#C4B5FD",
    "#A7F3D0",
]


def get_retailai_plotly_template():
    theme = st.get_option("theme.base")
    return "plotly_dark" if theme == "dark" else "plotly_white"


def apply_retailai_chart_style(fig, height=420, title=None, showlegend=False):
    """Apply RetailAI's soft SaaS chart styling without changing chart data."""
    theme = st.get_option("theme.base")

    if theme == "dark":
        paper_bg = "rgba(17,24,39,0)"
        plot_bg = "rgba(17,24,39,0)"
        grid = "rgba(255,255,255,0.10)"
        font = "#F9FAFB"
        muted = "#D1D5DB"
    else:
        paper_bg = "rgba(255,255,255,0)"
        plot_bg = "rgba(255,247,251,0.42)"
        grid = "rgba(249,168,212,0.20)"
        font = PASTEL_THEME["text"]
        muted = PASTEL_THEME["muted"]

    fig.update_layout(
        template=get_retailai_plotly_template(),
        height=height,
        title_text=title if title else "",
        showlegend=showlegend,
        paper_bgcolor=paper_bg,
        plot_bgcolor=plot_bg,
        font=dict(color=font, family="Inter, Segoe UI, Arial, sans-serif"),
        margin=dict(l=24, r=24, t=56 if title else 28, b=36),
        hoverlabel=dict(
            bgcolor="rgba(255,255,255,0.96)",
            bordercolor=PASTEL_THEME["primary"],
            font_size=12,
            font_color=PASTEL_THEME["text"],
        ),
    )

    fig.update_xaxes(
        gridcolor=grid,
        zerolinecolor=grid,
        linecolor="rgba(156,163,175,0.28)",
        tickfont=dict(color=muted),
        title_font=dict(color=muted),
    )
    fig.update_yaxes(
        gridcolor=grid,
        zerolinecolor=grid,
        linecolor="rgba(156,163,175,0.28)",
        tickfont=dict(color=muted),
        title_font=dict(color=muted),
    )

    return fig


def render_empty_state_card(title, message, requirements=None, icon="🧭", tone="neutral"):
    """Reusable premium empty/unavailable state for capability-aware pages."""
    tone_map = {
        "neutral": (PASTEL_THEME["primary_dark"], "rgba(252,231,243,0.56)", "rgba(249,168,212,0.36)"),
        "warning": (PASTEL_THEME["peach_dark"], "rgba(255,237,213,0.74)", "rgba(251,191,36,0.32)"),
        "info": (PASTEL_THEME["sky_dark"], "rgba(224,242,254,0.72)", "rgba(147,197,253,0.34)"),
        "success": (PASTEL_THEME["mint_dark"], "rgba(220,252,231,0.72)", "rgba(134,239,172,0.34)"),
        "danger": (PASTEL_THEME["rose_dark"], "rgba(255,228,230,0.72)", "rgba(251,113,133,0.32)"),
    }

    color, bg, border = tone_map.get(tone, tone_map["neutral"])

    requirement_html = ""
    if requirements:
        items = "".join(f"<li style='margin-bottom:5px;'>{safe(item)}</li>" for item in requirements)
        requirement_html = (
            f"<div style='margin-top:12px;padding:12px 14px;border-radius:14px;"
            f"background:rgba(255,255,255,0.62);border:1px solid rgba(249,168,212,0.22);'>"
            f"<div style='font-size:12px;font-weight:850;color:{color};text-transform:uppercase;"
            f"letter-spacing:0.35px;margin-bottom:6px;'>Recommended focus</div>"
            f"<ul style='margin:0;padding-left:18px;color:{PASTEL_THEME['muted']};"
            f"font-size:13px;line-height:1.55;'>{items}</ul></div>"
        )

    html_block = (
        f"<div class='premium-card' style='padding:20px;border-radius:20px;border:1px solid {border};"
        f"background:linear-gradient(135deg,{bg},rgba(255,255,255,0.78));"
        f"box-shadow:0 8px 24px {PASTEL_THEME['shadow_neutral']};margin-bottom:16px;"
        f"max-width:100%;overflow-wrap:anywhere;word-break:normal;'>"
        f"<div style='display:flex;gap:14px;align-items:flex-start;max-width:100%;'>"
        f"<div style='font-size:24px;line-height:1;flex:0 0 auto;'>{safe(icon)}</div>"
        f"<div style='flex:1;min-width:0;'>"
        f"<div style='font-size:15px;font-weight:900;color:{PASTEL_THEME['text']};margin-bottom:6px;'>{safe(title)}</div>"
        f"<div style='font-size:13px;color:{PASTEL_THEME['muted']};line-height:1.6;'>{safe(message)}</div>"
        f"{requirement_html}</div></div></div>"
    )
    st.markdown(html_block, unsafe_allow_html=True)

