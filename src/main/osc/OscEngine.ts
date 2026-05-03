type OscArg = { type: string; value: number | string | boolean }

export class OscEngine {
  private client: any = null

  send(host: string, port: number, address: string, args: OscArg[]): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Client } = require('node-osc')
      const client = new Client(host, port)
      const mappedArgs = args.map(a => {
        if (a.type === 'T') return true
        if (a.type === 'F') return false
        return a.value
      })
      client.send(address, ...mappedArgs, () => client.close())
    } catch (e) {
      console.error('OSC send error:', e)
    }
  }

  startListener(port: number): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Server } = require('node-osc')
      if (this.client) return
      this.client = new Server(port, '0.0.0.0', () => {
        console.log(`OSC listener on port ${port}`)
      })
    } catch (e) {
      console.error('OSC listener error:', e)
    }
  }
}
