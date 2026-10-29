"""Crea icone.js con le icone Fluent UI System Icons (Microsoft, licenza MIT) usate nel video.

Uso: python3 genera_icone.py <cartella icons del pacchetto npm @fluentui/svg-icons>
"""

import json
import re
import sys
from pathlib import Path

NOMI = """
arrow_left_20_regular arrow_clockwise_20_regular lock_closed_12_regular star_20_regular
star_line_horizontal_3_20_regular more_horizontal_20_regular dismiss_12_regular add_16_regular
split_vertical_20_regular person_circle_20_regular grid_dots_20_regular grid_20_regular search_20_regular
diamond_20_regular alert_20_regular navigation_20_regular compose_20_regular delete_20_regular
archive_20_regular shield_error_20_regular folder_arrow_right_20_regular arrow_reply_all_20_regular
mail_read_20_regular flag_20_regular chevron_down_12_regular chevron_down_16_regular
mail_inbox_20_regular send_20_regular drafts_20_regular folder_20_regular note_20_regular
people_team_20_regular mail_prohibited_20_regular history_20_regular calendar_ltr_20_regular
people_20_regular checkmark_20_regular apps_20_regular filter_20_regular arrow_sort_20_regular
multiselect_ltr_20_regular arrow_undo_20_regular square_multiple_20_regular
home_20_regular person_20_regular receipt_20_regular desktop_20_regular shield_20_regular
lock_closed_20_regular cart_20_regular payment_20_regular location_20_regular question_20_regular
key_20_regular laptop_20_regular chevron_up_20_regular chevron_right_20_regular
person_key_20_regular cloud_archive_20_regular phone_laptop_20_regular person_feedback_20_regular
mail_20_regular mail_20_filled add_20_regular dismiss_20_regular phone_20_regular fingerprint_20_regular
checkmark_circle_20_filled checkmark_circle_24_filled info_20_regular warning_20_regular
eye_20_regular password_20_regular shield_checkmark_20_regular mail_checkmark_20_regular
chevron_down_20_regular add_circle_20_regular person_lock_20_filled question_circle_20_regular globe_20_regular
dismiss_circle_20_regular person_add_20_regular chevron_left_24_regular text_align_left_24_regular backspace_24_regular
mic_24_regular emoji_20_regular keyboard_shift_20_regular globe_24_regular arrow_clockwise_24_regular square_multiple_24_regular
navigation_24_regular alert_24_regular search_24_regular edit_24_regular chevron_up_20_regular
"""


def main():
    cartella = Path(sys.argv[1])
    icone = {}
    for nome in NOMI.split():
        svg = (cartella / f"{nome}.svg").read_text()
        svg = re.sub(r'\s(width|height)="\d+"', "", svg).replace("<svg ", '<svg fill="currentColor" ', 1)
        icone[nome] = svg
    uscita = Path(__file__).with_name("icone.js")
    uscita.write_text(
        "// Fluent UI System Icons, © Microsoft Corporation, licenza MIT.\n"
        "// File generato da genera_icone.py.\n"
        f"window.ICONE = {json.dumps(icone, indent=0)};\n"
    )
    print(f"{len(icone)} icone scritte in {uscita}")


if __name__ == "__main__":
    main()
