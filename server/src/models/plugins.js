// Shared toJSON: expose `id`, hide __v.
export function cleanJson(schema, hide = []) {
  schema.set('toJSON', {
    virtuals: false, versionKey: false,
    transform(_doc, ret) { ret.id = String(ret._id); delete ret._id; for (const k of hide) delete ret[k]; return ret; },
  });
}
