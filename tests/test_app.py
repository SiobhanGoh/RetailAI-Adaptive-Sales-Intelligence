"""All default-data pages must render with the repaired pipeline and report export."""
from pathlib import Path
import pytest
from streamlit.testing.v1 import AppTest


@pytest.mark.parametrize('section', [0, 1, 2, 3, 4])
def test_default_page_renders(section, monkeypatch):
    root = Path(__file__).resolve().parents[1]
    monkeypatch.chdir(root)
    app = AppTest.from_file(str(root/'app.py'), default_timeout=120).run()
    assert not app.exception, [e.message for e in app.exception]
    nav = next(r for r in app.sidebar.radio if r.label == 'Go to')
    nav.set_value(nav.options[section]).run(timeout=120)
    assert not app.exception, [e.message for e in app.exception]
