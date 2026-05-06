import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export async function adjustVolume(value: number, isAbsolute = false) {
  try {
    if (isAbsolute) {
      await execAsync(`pactl set-sink-volume @DEFAULT_SINK@ ${value}%`)
    } else {
      const sign = value >= 0 ? '+' : ''
      const delta = `${sign}${value}%`
      await execAsync(`pactl set-sink-volume @DEFAULT_SINK@ ${delta}`)
    }
    return true
  } catch (e) {
    console.error('Failed to adjust volume:', e)
    return false
  }
}

export async function getVolume(): Promise<number> {
  try {
    const { stdout } = await execAsync("pactl get-sink-volume @DEFAULT_SINK@ | grep -Po '\\d+(?=%)' | head -n 1")
    return parseInt(stdout.trim()) || 0
  } catch (e) {
    console.error('Failed to get volume:', e)
    return 50
  }
}


export async function toggleMute() {
  try {
    await execAsync('pactl set-sink-mute @DEFAULT_SINK@ toggle')
    return true
  } catch (e) {
    console.error('Failed to toggle mute:', e)
    return false
  }
}

export async function adjustBrightness(value?: number) {
  try {
    const { stdout } = await execAsync("xrandr --query | grep ' connected' | cut -d' ' -f1")
    const outputs = stdout.trim().split('\n')
    if (outputs.length === 0) return false

    for (const output of outputs) {
      let next = 0.4
      
      if (value !== undefined) {
        next = value
      } else {
        // Toggle logic if no value provided
        const { stdout: verbose } = await execAsync(`xrandr --verbose --output ${output} | grep -i brightness`)
        const current = parseFloat(verbose.split(':')[1].trim())
        if (current < 0.6) next = 0.7
        else if (current < 0.9) next = 1.0
        else next = 0.4
      }
      
      await execAsync(`xrandr --output ${output} --brightness ${next.toFixed(2)}`)
    }
    return true
  } catch (e) {
    console.error('Failed to adjust brightness:', e)
    return false
  }
}
