import cds from '@sap/cds'

const { SELECT, UPDATE } = cds.ql

export default class NotesAgent extends cds.ApplicationService {
  init() {
    const { Notes } = this.entities

    this.on('complete', async (req: cds.Request) => {
      const { ID } = req.data as { ID: string }
      const updated = await UPDATE(Notes).set({ done: true }).where({ ID })
      if (!updated) return req.reject(404, `Note ${ID} not found`)
      return true
    })

    this.on('openCount', async () => {
      const row = await SELECT.one.from(Notes).columns('count(*) as n').where({ done: false })
      return Number(row?.n ?? 0)
    })

    this.on('rename', async (req: cds.Request) => {
      const { ID, title } = req.data as { ID: string, title: string }
      if (!title?.trim()) return req.reject(400, 'title must not be empty')
      const updated = await UPDATE(Notes).set({ title: title.trim() }).where({ ID })
      if (!updated) return req.reject(404, `Note ${ID} not found`)
      return true
    })

    return super.init()
  }
}
