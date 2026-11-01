import cds from '@sap/cds'

const { SELECT } = cds.ql

const countNotes = async (where?: Record<string, unknown>) => {
  const q = SELECT.one.from('demo.Notes').columns('count(*) as n')
  const row = await (where ? q.where(where) : q)
  return Number(row?.n ?? 0)
}

export class ReviewAgent extends cds.ApplicationService {
  init() {
    this.on('doneCount', () => countNotes({ done: true }))
    return super.init()
  }
}

export class NotesStats extends cds.ApplicationService {
  init() {
    this.on('totalCount', () => countNotes())
    return super.init()
  }
}
