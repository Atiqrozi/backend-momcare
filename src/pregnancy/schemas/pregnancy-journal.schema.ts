import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'pregnancyJournals' })
export class PregnancyJournal {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true })
  entryDate!: Date;

  @Prop({ trim: true, maxlength: 50 })
  mood?: string;

  @Prop({ type: [String], default: [] })
  symptoms!: string[];

  @Prop({ trim: true, maxlength: 2000 })
  notes?: string;
}

export type PregnancyJournalDocument = HydratedDocument<PregnancyJournal>;
export const PregnancyJournalSchema = SchemaFactory.createForClass(PregnancyJournal);
