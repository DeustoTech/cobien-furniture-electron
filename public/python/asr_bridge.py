import sys
import os
import json

# Add current directory to path for local virtual_assistant imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


from virtual_assistant.recognizer import SpeechRecognizer

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing model path"}))
        return

    model_path = sys.argv[1]
    
    # Check if we are in wake-word mode
    is_wake_mode = "--wake-word" in sys.argv
    wake_word = "cobien" # Default wake word
    
    # Find wake word in args if present after --wake-word
    for i, arg in enumerate(sys.argv):
        if arg == "--wake-word" and i + 1 < len(sys.argv):
            wake_word = sys.argv[i+1]
            break

    try:
        recognizer = SpeechRecognizer(model_path)
        
        if is_wake_mode:
            # Loop indefinitely for wake word
            while True:
                found = recognizer.wait_for_keyword(wake_word)
                if found:
                    print(json.dumps({"wake_word_detected": wake_word}))
                    sys.stdout.flush()
                    # After detection, we exit or wait? 
                    # Usually we exit so Electron can start the full ASR
                    break
        else:
            # Standard STT mode
            def level_cb(lvl):
                print(json.dumps({"level": lvl}))
                sys.stdout.flush()

            text = recognizer.listen_and_transcribe(
                timeout=10, 
                level_callback=level_cb,
                partial_callback=lambda p: print(json.dumps({"partial": p})) or sys.stdout.flush()
            )

            if text:
                print(json.dumps({"text": text}))
            else:
                print(json.dumps({"text": ""}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))


if __name__ == "__main__":
    main()
