"""Builds the client's icon assets from the approved picks in this folder.

Each glyph is written white-on-transparent (alpha = the source's brightness), so the client can
color it with a CSS mask: neutral grey by default, the element's color, or a fusion's gradient.

    python icons/_build-client-icons.py    (needs Pillow)

Output: apps/client/public/assets/icons/{skills,minion-skills,statuses}/*.png and manifest.json,
which maps each archetype (lowercase), minion skill id and status id to its file. Statuses that
share an icon share one file.
"""
import json
import os
import shutil

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "apps", "client", "public", "assets", "icons")
BOSS_ICON = "s4_r1_c2"  # crowned skull: every story boss passive


def load(name):
    with open(os.path.join(HERE, name), encoding="utf8") as f:
        return json.load(f)


def glyph(src, dest):
    gray = Image.open(os.path.join(HERE, src + ".png")).convert("L")
    out = Image.new("RGBA", gray.size, (255, 255, 255, 0))
    out.putalpha(gray)
    out.save(os.path.join(OUT, dest), optimize=True)


def boss_ids():
    story = os.path.join(HERE, "..", "packages", "content", "data", "story")
    ids = []
    for root, _, files in os.walk(story):
        for f in files:
            if f.startswith("statuses") and f.endswith(".yaml"):
                for line in open(os.path.join(root, f), encoding="utf8"):
                    if line and not line[0].isspace() and line.rstrip().endswith(":") and not line.startswith("#"):
                        ids.append(line.strip()[:-1])
    return sorted(ids)


shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(os.path.join(OUT, "skills"))
os.makedirs(os.path.join(OUT, "statuses"))
manifest = {"skills": {}, "statuses": {}}

for archetype, v in load("_archetype-candidates.json").items():
    key = archetype.lower()
    glyph(v["primary"], f"skills/{key}.png")
    manifest["skills"][key] = f"skills/{key}.png"

# Minion skills share the "Minion" archetype, so each has its own glyph by skill id (repeats allowed).
manifest["skillsById"] = {}
os.makedirs(os.path.join(OUT, "minion-skills"))
for skill_id, src in load("_minion-skill-icons.json").items():
    glyph(src, f"minion-skills/{skill_id}.png")
    manifest["skillsById"][skill_id] = f"minion-skills/{skill_id}.png"

core = load("_status-candidates.json")
fusion = load("_fusion-status-candidates.json")
for sid, v in list(core.items()) + [(k, v) for k, v in fusion.items() if "primary" in v]:
    glyph(v["primary"], f"statuses/{sid}.png")
    manifest["statuses"][sid] = f"statuses/{sid}.png"
for sid, v in fusion.items():
    if "sharesWith" in v:
        manifest["statuses"][sid] = manifest["statuses"][v["sharesWith"]]

glyph(BOSS_ICON, "statuses/boss.png")
for sid in boss_ids():
    manifest["statuses"][sid] = "statuses/boss.png"

with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf8") as f:
    json.dump(manifest, f, indent=2, sort_keys=True)
    f.write("\n")
print(len(manifest["skills"]), "skills,", len(manifest["skillsById"]), "minion skills,", len(manifest["statuses"]), "statuses")
