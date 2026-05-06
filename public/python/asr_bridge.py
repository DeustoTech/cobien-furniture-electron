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
    prompt = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        # Level callback for visualizer
        def level_cb(lvl):
            print(json.dumps({"level": lvl}))
            sys.stdout.flush()

        # Custom loop to handle partial results if we wanted to modify recognizer.py,
        # but let's see if we can do it here by calling a more granular method if available.
        # Since recognizer.py encapsulates the loop, we might need to modify it or 
        # implement a similar loop here.
        
        # Let's check if we can modify recognizer.py or if we should just implement the loop here.
        # recognizer.py has:
        # def listen_and_transcribe(self, timeout=15, stop_event=None, level_callback=None)
        
        recognizer = SpeechRecognizer(model_path)
        
        # I will modify recognizer.py to support a partial_callback.
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
