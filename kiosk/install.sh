#!/bin/bash
# Installerer kiosk-oppsettet (idempotent). KIOSK_HOME/ROOTFS kan settes for å installere på et montert SD-kort.
H="${KIOSK_HOME:-$HOME}"; ROOT="${ROOTFS:-}"; SRC="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
mkdir -p "$H/.local/bin" "$H/.config/systemd/user/default.target.wants" "$H/.config/systemd/user/timers.target.wants" "$H/.config/labwc"
install -m755 "$SRC"/bin/* "$H/.local/bin/"
install -m644 "$SRC"/systemd/* "$H/.config/systemd/user/"
ln -sfn ../magicmirror.service "$H/.config/systemd/user/default.target.wants/magicmirror.service"
ln -sfn ../mm-update.timer "$H/.config/systemd/user/timers.target.wants/mm-update.timer"
for m in "$SRC"/modules/*/; do mkdir -p "$H/MagicMirror/modules/$(basename "$m")"; cp -a "$m". "$H/MagicMirror/modules/$(basename "$m")/"; done
[ -f "$H/MagicMirror/config/config.js" ] || cp "$SRC/config.template.js" "$H/MagicMirror/config/config.js"
cp "$SRC/custom.css" "$H/MagicMirror/config/custom.css"
# labwc: autostart + Super+M
A="$H/.config/labwc/autostart"
[ -f "$A" ] || cp "$ROOT/etc/xdg/labwc/autostart" "$A"
grep -q mm-mode "$A" || printf '\n# MagicMirror kiosk (Super+M bytter)\n$HOME/.local/bin/mm-mode mirror &\n' >> "$A"
RC="$H/.config/labwc/rc.xml"
[ -f "$RC" ] || cp "$ROOT/etc/xdg/labwc/rc.xml" "$RC"
grep -q mm-mode "$RC" || python3 - "$RC" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read(); i=s.index('  </keyboard>')
s=s[:i]+'''    <keybind key="W-m">
      <action name="Execute" command="sh -c '$HOME/.local/bin/mm-mode toggle'" />
    </keybind>
'''+s[i:]; open(p,'w').write(s)
PY
[ -z "${KIOSK_HOME:-}" ] && systemctl --user daemon-reload 2>/dev/null
exit 0
