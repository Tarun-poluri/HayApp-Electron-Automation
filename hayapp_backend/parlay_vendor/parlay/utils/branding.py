"""
Utility functions for changing the branding on parlay
"""
import os
import sys
import parlay
import shutil

def change_logo(new_logo_path):
    """
    Change the logo in the upper right (may require root)
    :param new_logo_path:  the path to the new logo file
    :return: None
    """
    ui_path = os.path.dirname(parlay.__file__) + "/ui/dist/static/media"
    # find the current logo
    for root, dirs, files in os.walk(ui_path):
        for file in files:
            # if we're the parlay_logo
            if file.startswith("parlay_logo."):
                # then replace us with the new logo
                shutil.copyfile(new_logo_path, ui_path+"/"+file)

