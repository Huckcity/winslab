type MidiMessage = {
  kind: string
  channel?: number
  note?: number
  velocity?: number
  controller?: number
  value?: number
  program?: number
  data?: number[]
}

export class MidiEngine {
  private outputs = new Map<string, any>()

  listOutputPorts(): string[] {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const midi = require('midi')
      const out = new midi.Output()
      const count = out.getPortCount()
      const ports: string[] = []
      for (let i = 0; i < count; i++) ports.push(out.getPortName(i))
      out.closePort()
      return ports
    } catch {
      return []
    }
  }

  private getOutput(portName: string): any {
    if (this.outputs.has(portName)) return this.outputs.get(portName)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const midi = require('midi')
      const out = new midi.Output()
      const count = out.getPortCount()
      for (let i = 0; i < count; i++) {
        if (out.getPortName(i) === portName) {
          out.openPort(i)
          this.outputs.set(portName, out)
          return out
        }
      }
    } catch {
      // midi module unavailable in dev
    }
    return null
  }

  send(portName: string, messages: MidiMessage[]): void {
    const out = this.getOutput(portName)
    if (!out) return
    for (const msg of messages) {
      const ch = (msg.channel ?? 1) - 1
      if (msg.kind === 'noteOn') out.sendMessage([0x90 | ch, msg.note!, msg.velocity!])
      else if (msg.kind === 'noteOff') out.sendMessage([0x80 | ch, msg.note!, msg.velocity!])
      else if (msg.kind === 'cc') out.sendMessage([0xB0 | ch, msg.controller!, msg.value!])
      else if (msg.kind === 'programChange') out.sendMessage([0xC0 | ch, msg.program!])
      else if (msg.kind === 'sysex') out.sendMessage([0xF0, ...msg.data!, 0xF7])
    }
  }
}
