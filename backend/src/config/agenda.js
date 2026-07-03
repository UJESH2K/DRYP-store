const { Agenda } = require('agenda');

const agenda = new Agenda({
  db: { address: process.env.MONGO_URI, collection: 'agendaJobs' },
  processEvery: '15 seconds',
});

agenda.on('fail', (err, job) => {
  console.error(`Agenda job "${job.attrs.name}" failed:`, err.message);
});

module.exports = agenda;
