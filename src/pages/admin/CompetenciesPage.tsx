import { useState, useEffect, useMemo } from 'react'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import type { LearningCompetency } from '@/types'
import {
  fetchLearningCompetencies,
  createLearningCompetency,
  updateLearningCompetency,
  deleteLearningCompetency,
  importBudgetOfWorkToSupabase,
  clearBudgetOfWorkSupabase
} from '@/lib/supabase/queries'
import extractedCompetencies from '@/data/extractedCompetencies.json'
import { useToast } from '@/hooks/useToast'
import {
  BookOpen, Search, Filter, Plus, Edit2, Trash2, RefreshCw,
  Sparkles, CheckCircle2, Layers, Clock, AlertCircle, X, ChevronRight,
  GraduationCap, BookMarked, Calendar, HelpCircle, UploadCloud, Database, FileJson, Check
} from 'lucide-react'

// Pre-seeded fallback data in case DB is offline or empty initially
const FALLBACK_COMPETENCIES: LearningCompetency[] = [
  // --- GRADE 1 ---
  { id: 'g1-m1', grade_number: 1, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M1NS-Ia-1.1', domain_strand: 'Numbers and Number Sense', competency_description: 'Visualizes, represents, and counts numbers from 0 to 100 using a variety of materials and methods.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g1-m2', grade_number: 1, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M1NS-Ib-2.1', domain_strand: 'Numbers and Number Sense', competency_description: 'Identifies the number that is one more or one less from a given number up to 100.', target_week: 'Week 2 - Day 1-3', target_days: 3, is_active: true },
  { id: 'g1-m3', grade_number: 1, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M1NS-Id-6', domain_strand: 'Numbers and Number Sense', competency_description: 'Compares two sets using expressions "less than", "more than", and "as many as" and orders numbers up to 100 in increasing or decreasing order.', target_week: 'Week 3 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g1-m4', grade_number: 1, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M1NS-If-9.1', domain_strand: 'Numbers and Number Sense', competency_description: 'Reads and writes numbers up to 100 in symbols and in words.', target_week: 'Week 4 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g1-m5', grade_number: 1, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M1NS-Ig-10.1', domain_strand: 'Numbers and Number Sense', competency_description: 'Visualizes and gives the place value and value of a digit in one- and two-digit numbers.', target_week: 'Week 5 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g1-m6', grade_number: 1, learning_area_name: 'Mathematics', term_name: '2nd Term / Quarter 2', code: 'M1NS-IIa-26.1', domain_strand: 'Addition and Subtraction', competency_description: 'Illustrates addition as "putting together" or "combining" sets of objects.', target_week: 'Week 1 - Day 1-4', target_days: 4, is_active: true },
  { id: 'g1-m7', grade_number: 1, learning_area_name: 'Mathematics', term_name: '2nd Term / Quarter 2', code: 'M1NS-IIe-30.1', domain_strand: 'Addition and Subtraction', competency_description: 'Visualizes and adds two 1-digit numbers with sums up to 18 using appropriate mental math strategies.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g1-m8', grade_number: 1, learning_area_name: 'Mathematics', term_name: '2nd Term / Quarter 2', code: 'M1NS-IIf-30.2', domain_strand: 'Addition and Subtraction', competency_description: 'Adds two 2-digit numbers with sums up to 99 without regrouping.', target_week: 'Week 3 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g1-m9', grade_number: 1, learning_area_name: 'Mathematics', term_name: '3rd Term / Quarter 3', code: 'M1GE-IIIa-1', domain_strand: 'Geometry', competency_description: 'Identifies, names, and describes four basic shapes (square, rectangle, triangle, circle) in 2D and 3D objects.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g1-m10', grade_number: 1, learning_area_name: 'Mathematics', term_name: '3rd Term / Quarter 3', code: 'M1ME-IIIg-1', domain_strand: 'Measurement', competency_description: 'Tells and writes time by hour and half-hour using analog and digital clocks.', target_week: 'Week 3 - Day 1-5', target_days: 5, is_active: true },

  { id: 'g1-e1', grade_number: 1, learning_area_name: 'English', term_name: '1st Term / Quarter 1', code: 'EN1G-Ia-1', domain_strand: 'Oral Language & Phonological Awareness', competency_description: 'Recognize rhyming words in nursery rhymes, poems, and chants listened to.', target_week: 'Week 1 - Day 1-4', target_days: 4, is_active: true },
  { id: 'g1-e2', grade_number: 1, learning_area_name: 'English', term_name: '1st Term / Quarter 1', code: 'EN1V-Ib-1', domain_strand: 'Alphabet Knowledge', competency_description: 'Give the name and sound of each letter of the alphabet.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g1-e3', grade_number: 1, learning_area_name: 'English', term_name: '2nd Term / Quarter 2', code: 'EN1G-IIa-e-3', domain_strand: 'Grammar Awareness', competency_description: 'Use naming words (nouns) in simple sentences (people, places, things, animals).', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g1-e4', grade_number: 1, learning_area_name: 'English', term_name: '3rd Term / Quarter 3', code: 'EN1LC-IIIa-j-1', domain_strand: 'Listening Comprehension', competency_description: 'Listen to short stories and answer simple who, what, and where questions.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },

  { id: 'g1-f1', grade_number: 1, learning_area_name: 'Filipino', term_name: '1st Term / Quarter 1', code: 'F1PN-Ia-k-1', domain_strand: 'Pag-unawa sa Napakinggan', competency_description: 'Naiuugnay ang sariling karanasan sa napakinggang kuwento.', target_week: 'Week 1 - Day 1-3', target_days: 3, is_active: true },
  { id: 'g1-f2', grade_number: 1, learning_area_name: 'Filipino', term_name: '1st Term / Quarter 1', code: 'F1KP-Ib-c-2', domain_strand: 'Kamalayang Ponolohiko', competency_description: 'Nabibigkas nang wasto ang tunog ng bawat titik ng alpabetong Filipino.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g1-f3', grade_number: 1, learning_area_name: 'Filipino', term_name: '2nd Term / Quarter 2', code: 'F1WG-IIa-c-1', domain_strand: 'Wika at Gramatika', competency_description: 'Nagagamit ang magalang na pananalita sa angkop na sitwasyon tulad ng pagbati.', target_week: 'Week 1 - Day 1-4', target_days: 4, is_active: true },
  { id: 'g1-f4', grade_number: 1, learning_area_name: 'Filipino', term_name: '3rd Term / Quarter 3', code: 'F1KM-IIIa-1', domain_strand: 'Pagsulat', competency_description: 'Nakasusulat ng malaki at maliit na titik nang may wastong layo sa isa’t isa.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },

  { id: 'g1-ap1', grade_number: 1, learning_area_name: 'Araling Panlipunan', term_name: '1st Term / Quarter 1', code: 'AP1NAT-Ia-1', domain_strand: 'Ako ay Natatangi', competency_description: 'Nailalarawan ang sariling buhay mula sa pagsilang hanggang sa kasalukuyang edad.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g1-ap2', grade_number: 1, learning_area_name: 'Araling Panlipunan', term_name: '2nd Term / Quarter 2', code: 'AP1PAM-IIa-1', domain_strand: 'Ang Aking Pamilya', competency_description: 'Natutukoy ang mga kasapi ng pamilya at ang kani-kanilang papel at tungkulin sa tahanan.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },

  // --- GRADE 2 ---
  { id: 'g2-m1', grade_number: 2, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M2NS-Ia-1.2', domain_strand: 'Numbers and Number Sense', competency_description: 'Visualizes and represents numbers from 0 to 1,000 using various grouping models.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g2-m2', grade_number: 2, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M2NS-Ic-10.2', domain_strand: 'Numbers and Number Sense', competency_description: 'Gives the place value and finds the value of a digit in three-digit numbers.', target_week: 'Week 2 - Day 1-4', target_days: 4, is_active: true },
  { id: 'g2-m3', grade_number: 2, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M2NS-Id-12.2', domain_strand: 'Numbers and Number Sense', competency_description: 'Compares numbers up to 1 000 using relation symbols (<, >, =).', target_week: 'Week 3 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g2-m4', grade_number: 2, learning_area_name: 'Mathematics', term_name: '2nd Term / Quarter 2', code: 'M2NS-IIa-38', domain_strand: 'Multiplication & Division', competency_description: 'Illustrates multiplication as repeated addition, counting by multiples, and equal groups.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g2-m5', grade_number: 2, learning_area_name: 'Mathematics', term_name: '2nd Term / Quarter 2', code: 'M2NS-IIb-40.1', domain_strand: 'Multiplication & Division', competency_description: 'Visualizes multiplication of numbers 1 to 10 by 2, 3, 4, 5 and 10.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g2-m6', grade_number: 2, learning_area_name: 'Mathematics', term_name: '3rd Term / Quarter 3', code: 'M2ME-IIIa-22', domain_strand: 'Measurement & Fractions', competency_description: 'Visualizes, represents, and identifies unit fractions (1/2, 1/3, 1/4, 1/5) in shapes and sets.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },

  { id: 'g2-e1', grade_number: 2, learning_area_name: 'English', term_name: '1st Term / Quarter 1', code: 'EN2V-Ia-5', domain_strand: 'Vocabulary Development', competency_description: 'Classify common words into categories (e.g., colors, shapes, animals, food).', target_week: 'Week 1 - Day 1-4', target_days: 4, is_active: true },
  { id: 'g2-e2', grade_number: 2, learning_area_name: 'English', term_name: '2nd Term / Quarter 2', code: 'EN2G-IIa-e-1.3', domain_strand: 'Grammar Awareness', competency_description: 'Use action words (verbs) in simple present, past, and future tenses in sentences.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g2-e3', grade_number: 2, learning_area_name: 'English', term_name: '3rd Term / Quarter 3', code: 'EN2RC-IIIa-2.4', domain_strand: 'Reading Comprehension', competency_description: 'Identify the basic elements of a story (characters, setting, events).', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },

  // --- GRADE 3 ---
  { id: 'g3-s1', grade_number: 3, learning_area_name: 'Science', term_name: '1st Term / Quarter 1', code: 'S3MT-Ia-b-1', domain_strand: 'Matter', competency_description: 'Classify objects and materials into solid, liquid, and gas based on observable characteristics.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g3-s2', grade_number: 3, learning_area_name: 'Science', term_name: '1st Term / Quarter 1', code: 'S3MT-Ic-d-2', domain_strand: 'Matter', competency_description: 'Describe changes in materials based on the effect of temperature (solid to liquid, liquid to gas).', target_week: 'Week 3 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g3-s3', grade_number: 3, learning_area_name: 'Science', term_name: '2nd Term / Quarter 2', code: 'S3LT-IIa-b-1', domain_strand: 'Living Things and Their Environment', competency_description: 'Describe the parts and functions of the sense organs of the human body.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g3-s4', grade_number: 3, learning_area_name: 'Science', term_name: '2nd Term / Quarter 2', code: 'S3LT-IIc-d-3', domain_strand: 'Living Things and Their Environment', competency_description: 'Describe animals according to their body coverings, movement, and habitat.', target_week: 'Week 3 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g3-s5', grade_number: 3, learning_area_name: 'Science', term_name: '3rd Term / Quarter 3', code: 'S3FE-IIIa-b-1', domain_strand: 'Force, Motion & Energy', competency_description: 'Describe the position and movement of an object in relation to a reference point.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },

  { id: 'g3-m1', grade_number: 3, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M3NS-Ia-1.3', domain_strand: 'Numbers and Number Sense', competency_description: 'Visualizes and represents numbers up to 10 000 with emphasis on numbers 1 001 to 10 000.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g3-m2', grade_number: 3, learning_area_name: 'Mathematics', term_name: '2nd Term / Quarter 2', code: 'M3NS-IIa-41.2', domain_strand: 'Multiplication and Division', competency_description: 'Multiplies 2- to 3-digit numbers by 1- to 2-digit numbers with or without regrouping.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g3-m3', grade_number: 3, learning_area_name: 'Mathematics', term_name: '3rd Term / Quarter 3', code: 'M3GE-IIIa-7', domain_strand: 'Geometry', competency_description: 'Recognizes and draws parallel, intersecting, and perpendicular lines.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },

  // --- GRADE 4 ---
  { id: 'g4-m1', grade_number: 4, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M4NS-Ia-10.1', domain_strand: 'Numbers and Number Sense', competency_description: 'Visualizes, reads, and writes numbers up to 100 000 in symbols and in words.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g4-m2', grade_number: 4, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M4NS-Ic-43.7', domain_strand: 'Multiplication and Division', competency_description: 'Multiplies 3-digit numbers by 2-digit numbers with or without regrouping.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g4-m3', grade_number: 4, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M4NS-If-54.3', domain_strand: 'Multiplication and Division', competency_description: 'Divides 3- to 4-digit numbers by 1- to 2-digit numbers with or without remainder.', target_week: 'Week 4 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g4-m4', grade_number: 4, learning_area_name: 'Mathematics', term_name: '2nd Term / Quarter 2', code: 'M4NS-IIa-67', domain_strand: 'Fractions & Decimals', competency_description: 'Identifies proper fractions, improper fractions, and mixed numbers.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g4-m5', grade_number: 4, learning_area_name: 'Mathematics', term_name: '2nd Term / Quarter 2', code: 'M4NS-IIb-68.1', domain_strand: 'Fractions & Decimals', competency_description: 'Changes improper fractions to mixed numbers and vice versa.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g4-m6', grade_number: 4, learning_area_name: 'Mathematics', term_name: '3rd Term / Quarter 3', code: 'M4ME-IIIa-49', domain_strand: 'Measurement & Geometry', competency_description: 'Finds the perimeter of triangles, squares, rectangles, parallelograms, and trapezoids.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },

  { id: 'g4-s1', grade_number: 4, learning_area_name: 'Science', term_name: '1st Term / Quarter 1', code: 'S4MT-Ia-1', domain_strand: 'Matter', competency_description: 'Classify materials based on their ability to absorb water, float, sink, undergo decay.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g4-s2', grade_number: 4, learning_area_name: 'Science', term_name: '1st Term / Quarter 1', code: 'S4MT-Ie-f-3', domain_strand: 'Matter', competency_description: 'Describe changes in materials that take place when heated, cooled, or mixed with other materials.', target_week: 'Week 3 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g4-s3', grade_number: 4, learning_area_name: 'Science', term_name: '2nd Term / Quarter 2', code: 'S4LT-IIa-b-1', domain_strand: 'Living Things and Their Environment', competency_description: 'Describe the main function of major internal organs (brain, heart, lungs, stomach, kidneys).', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g4-s4', grade_number: 4, learning_area_name: 'Science', term_name: '3rd Term / Quarter 3', code: 'S4FE-IIIa-1', domain_strand: 'Force & Motion', competency_description: 'Explain how force applied to an object may change its size, shape, or movement.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },

  // --- GRADE 5 ---
  { id: 'g5-s1', grade_number: 5, learning_area_name: 'Science', term_name: '1st Term / Quarter 1', code: 'S5MT-Ia-b-1', domain_strand: 'Matter', competency_description: 'Use the properties of materials whether they are useful or harmful in everyday life.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g5-s2', grade_number: 5, learning_area_name: 'Science', term_name: '1st Term / Quarter 1', code: 'S5MT-Ic-d-2', domain_strand: 'Matter', competency_description: 'Investigate changes that materials undergo when exposed to oxygen or heat (chemical vs physical change).', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g5-s3', grade_number: 5, learning_area_name: 'Science', term_name: '2nd Term / Quarter 2', code: 'S5LT-IIa-1', domain_strand: 'Living Things and Their Environment', competency_description: 'Describe the parts of the human reproductive system and their functions.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g5-s4', grade_number: 5, learning_area_name: 'Science', term_name: '3rd Term / Quarter 3', code: 'S5FE-IIIa-1', domain_strand: 'Force, Motion & Energy', competency_description: 'Describe how motion of an object can be changed by magnetic and gravitational forces.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },

  { id: 'g5-m1', grade_number: 5, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M5NS-Ia-101.1', domain_strand: 'Numbers and Number Sense', competency_description: 'Uses divisibility rules for 2, 5, and 10 to find common factors of numbers.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g5-m2', grade_number: 5, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M5NS-Id-122', domain_strand: 'Numbers and Number Sense', competency_description: 'Finds the Prime Factors, GCF, and LCM of 2 to 3 numbers using continuous division.', target_week: 'Week 3 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g5-m3', grade_number: 5, learning_area_name: 'Mathematics', term_name: '2nd Term / Quarter 2', code: 'M5NS-IIa-106.1', domain_strand: 'Decimals & Percentage', competency_description: 'Gives the place value and the value of a digit of a given decimal number through ten thousandths.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g5-m4', grade_number: 5, learning_area_name: 'Mathematics', term_name: '3rd Term / Quarter 3', code: 'M5GE-IIIa-27', domain_strand: 'Geometry', competency_description: 'Visualizes and describes solid figures (cube, prism, pyramid, cylinder, cone, sphere).', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },

  // --- GRADE 6 ---
  { id: 'g6-m1', grade_number: 6, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M6NS-Ia-86.1', domain_strand: 'Fractions and Decimals', competency_description: 'Adds and subtracts simple fractions and mixed numbers with or without regrouping.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g6-m2', grade_number: 6, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M6NS-Ib-90.2', domain_strand: 'Fractions and Decimals', competency_description: 'Multiplies simple fractions and mixed fractions using models and cancellation method.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g6-m3', grade_number: 6, learning_area_name: 'Mathematics', term_name: '1st Term / Quarter 1', code: 'M6NS-Ib-92.2', domain_strand: 'Fractions and Decimals', competency_description: 'Solves routine and non-routine problems involving division of fractions using appropriate strategies.', target_week: 'Week 3 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g6-m4', grade_number: 6, learning_area_name: 'Mathematics', term_name: '2nd Term / Quarter 2', code: 'M6NS-IIa-129', domain_strand: 'Ratio and Proportion', competency_description: 'Expresses one value as a fraction of another given their ratio and vice versa.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g6-m5', grade_number: 6, learning_area_name: 'Mathematics', term_name: '2nd Term / Quarter 2', code: 'M6NS-IIb-133', domain_strand: 'Ratio and Proportion', competency_description: 'Finds a missing term in a proportion (direct, inverse, and partitive proportion).', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g6-m6', grade_number: 6, learning_area_name: 'Mathematics', term_name: '3rd Term / Quarter 3', code: 'M6ME-IIIa-93', domain_strand: 'Measurement & Geometry', competency_description: 'Calculates the surface area of 3D figures (cubes, prisms, pyramids, cylinders).', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },

  { id: 'g6-s1', grade_number: 6, learning_area_name: 'Science', term_name: '1st Term / Quarter 1', code: 'S6MT-Ia-c-1', domain_strand: 'Matter', competency_description: 'Describe the appearance and uses of homogeneous and heterogeneous mixtures.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g6-s2', grade_number: 6, learning_area_name: 'Science', term_name: '1st Term / Quarter 1', code: 'S6MT-Id-f-2', domain_strand: 'Matter', competency_description: 'Describe techniques in separating mixtures such as decantation, evaporation, filtering, sieving, and using magnet.', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g6-s3', grade_number: 6, learning_area_name: 'Science', term_name: '2nd Term / Quarter 2', code: 'S6LT-IIa-b-1', domain_strand: 'Living Things and Their Environment', competency_description: 'Explain how organ systems work together (circulatory, respiratory, nervous, digestive).', target_week: 'Week 2 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g6-s4', grade_number: 6, learning_area_name: 'Science', term_name: '2nd Term / Quarter 2', code: 'S6LT-IIe-f-3', domain_strand: 'Living Things and Their Environment', competency_description: 'Describe the distinguishing characteristics of vertebrates and invertebrates.', target_week: 'Week 4 - Day 1-5', target_days: 5, is_active: true },
  { id: 'g6-s5', grade_number: 6, learning_area_name: 'Science', term_name: '3rd Term / Quarter 3', code: 'S6FE-IIIa-c-1', domain_strand: 'Force, Motion & Energy', competency_description: 'Demonstrate how simple machines (lever, pulley, inclined plane, wedge, screw) make work easier.', target_week: 'Week 1 - Day 1-5', target_days: 5, is_active: true },
]

export function CompetenciesPage() {
  const { toast } = useToast()

  const [competencies, setCompetencies] = useState<LearningCompetency[]>([])
  const [loading, setLoading] = useState(true)
  const [isLiveFromSupabase, setIsLiveFromSupabase] = useState(false)

  // Filters
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all')
  const [selectedLearningArea, setSelectedLearningArea] = useState<string>('all')
  const [selectedTerm, setSelectedTerm] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Import Modal & Progress State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ processed: 0, total: 0 })
  const [importStatusText, setImportStatusText] = useState('')

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<LearningCompetency | null>(null)
  const [formData, setFormData] = useState({
    grade_number: 1,
    learning_area_name: 'Mathematics',
    term_name: '1st Term / Quarter 1',
    code: '',
    domain_strand: '',
    competency_description: '',
    target_week: 'Week 1-2',
    target_days: 5,
  })
  const [isSaving, setIsSaving] = useState(false)

  // Load Data
  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetchLearningCompetencies({
        grade_number: selectedGrade === 'all' ? undefined : selectedGrade,
        learning_area_name: selectedLearningArea === 'all' ? undefined : selectedLearningArea,
        term_name: selectedTerm === 'all' ? undefined : selectedTerm,
        search: searchQuery,
      })
      setCompetencies(res.data)
      setIsLiveFromSupabase(res.isLiveFromSupabase)
    } catch (err) {
      console.error(err)
      setCompetencies(extractedCompetencies as LearningCompetency[])
      setIsLiveFromSupabase(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Sync Extracted PDF Competencies to Supabase
  const handleImportSyncExtracted = async () => {
    if (!window.confirm(`Are you sure you want to upload all ${extractedCompetencies.length} extracted competencies to Supabase sc_budget_of_work table?`)) return

    setIsImporting(true)
    setImportProgress({ processed: 0, total: extractedCompetencies.length })
    setImportStatusText(`Preparing to upload ${extractedCompetencies.length} competencies...`)

    try {
      await importBudgetOfWorkToSupabase(extractedCompetencies as Partial<LearningCompetency>[], (processed, total) => {
        setImportProgress({ processed, total })
        setImportStatusText(`Uploading batch: ${processed.toLocaleString()} of ${total.toLocaleString()} competencies...`)
      })

      toast(`Successfully imported all ${extractedCompetencies.length} BOW competencies to Supabase sc_budget_of_work!`, 'success')
      setIsImportModalOpen(false)
      loadData()
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'Failed to upload competencies to Supabase.', 'error')
    } finally {
      setIsImporting(false)
    }
  }

  // Handle Custom JSON File Upload
  const handleCustomJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportStatusText(`Reading ${file.name}...`)

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid JSON structure. Expected an array of competency objects.')
      }

      setImportProgress({ processed: 0, total: parsed.length })
      setImportStatusText(`Importing ${parsed.length} entries from ${file.name}...`)

      await importBudgetOfWorkToSupabase(parsed, (processed, total) => {
        setImportProgress({ processed, total })
        setImportStatusText(`Uploading batch: ${processed.toLocaleString()} of ${total.toLocaleString()} competencies...`)
      })

      toast(`Successfully imported ${parsed.length} entries from ${file.name} to Supabase sc_budget_of_work!`, 'success')
      setIsImportModalOpen(false)
      loadData()
    } catch (err: any) {
      console.error(err)
      toast(`JSON Import Error: ${err.message || 'Failed to parse JSON file'}`, 'error')
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  // Clear Supabase Table
  const handleClearTable = async () => {
    if (!window.confirm('WARNING: Are you sure you want to clear all data in sc_budget_of_work table in Supabase?')) return
    try {
      await clearBudgetOfWorkSupabase()
      toast('sc_budget_of_work table cleared.', 'success')
      loadData()
    } catch (err) {
      console.error(err)
      toast('Failed to clear Supabase table.', 'error')
    }
  }

  // Derived unique options for filter dropdowns
  const availableLearningAreas = useMemo(() => {
    const list = Array.from(new Set(competencies.map(c => c.learning_area_name))).filter(Boolean)
    return ['all', ...list]
  }, [competencies])

  const availableTerms = useMemo(() => {
    const list = Array.from(new Set(competencies.map(c => c.term_name))).filter(Boolean)
    return ['all', ...list]
  }, [competencies])

  // Filtered list
  const filteredCompetencies = useMemo(() => {
    return competencies.filter(item => {
      if (selectedGrade !== 'all' && item.grade_number !== selectedGrade) return false
      if (selectedLearningArea !== 'all' && item.learning_area_name !== selectedLearningArea) return false
      if (selectedTerm !== 'all' && item.term_name !== selectedTerm) return false
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim()
        const matchCode = item.code?.toLowerCase().includes(q)
        const matchDomain = item.domain_strand?.toLowerCase().includes(q)
        const matchDesc = item.competency_description?.toLowerCase().includes(q)
        const matchSubject = item.learning_area_name?.toLowerCase().includes(q)
        if (!matchCode && !matchDomain && !matchDesc && !matchSubject) return false
      }
      return true
    })
  }, [competencies, selectedGrade, selectedLearningArea, selectedTerm, searchQuery])

  // Stat metrics
  const stats = useMemo(() => {
    const total = competencies.length
    const term1Count = competencies.filter(c => c.term_name?.toLowerCase().includes('1')).length
    const term2Count = competencies.filter(c => c.term_name?.toLowerCase().includes('2')).length
    const term3Count = competencies.filter(c => c.term_name?.toLowerCase().includes('3')).length
    return { total, term1Count, term2Count, term3Count }
  }, [competencies])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedGrade, selectedLearningArea, selectedTerm, searchQuery])

  // Paginated list
  const totalPages = Math.ceil(filteredCompetencies.length / pageSize) || 1
  const paginatedCompetencies = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredCompetencies.slice(start, start + pageSize)
  }, [filteredCompetencies, currentPage, pageSize])

  // Handlers for Add/Edit
  const handleOpenAdd = () => {
    setEditingItem(null)
    setFormData({
      grade_number: selectedGrade === 'all' ? 1 : selectedGrade,
      learning_area_name: selectedLearningArea === 'all' ? 'Mathematics' : selectedLearningArea,
      term_name: selectedTerm === 'all' ? '1st Term / Quarter 1' : selectedTerm,
      code: '',
      domain_strand: '',
      competency_description: '',
      target_week: 'Week 1-2',
      target_days: 5,
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item: LearningCompetency) => {
    setEditingItem(item)
    setFormData({
      grade_number: item.grade_number,
      learning_area_name: item.learning_area_name,
      term_name: item.term_name,
      code: item.code || '',
      domain_strand: item.domain_strand || '',
      competency_description: item.competency_description || '',
      target_week: item.target_week || 'Week 1-2',
      target_days: item.target_days || 5,
    })
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.competency_description.trim()) {
      toast('Competency description is required.', 'warning')
      return
    }

    setIsSaving(true)
    try {
      if (editingItem) {
        const updated = await updateLearningCompetency(editingItem.id, formData)
        setCompetencies(prev => prev.map(item => (item.id === editingItem.id ? { ...item, ...updated } : item)))
        toast('Competency updated successfully.', 'success')
      } else {
        const created = await createLearningCompetency(formData)
        setCompetencies(prev => [created, ...prev])
        toast('New competency added to Budget of Work.', 'success')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error(err)
      toast('Failed to save competency.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this competency from the Budget of Work?')) return
    try {
      await deleteLearningCompetency(id)
      setCompetencies(prev => prev.filter(c => c.id !== id))
      toast('Competency removed from Budget of Work.', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to delete competency.', 'error')
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 pb-12">
        {/* Top Header Banner - Claymorphism Warm Theme */}
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#FAF5F0] via-[#FFF9F2] to-[#F5EFE6] p-6 sm:p-8 border border-[#EFE6DB] shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8B72F4]/15 text-[#8B72F4] text-xs font-semibold uppercase tracking-wider">
                <Sparkles size={14} /> DepEd K-12 / MATATAG Curriculum
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2D2A26] tracking-tight">
                Budget of Work — Learning Competencies
              </h1>
              <p className="text-sm sm:text-base text-[#6E675F] max-w-2xl">
                Official DepEd Three-Term Budget of Work (BOW) for Learning Competencies across Grade 1 to Grade 6 primary learning areas.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                className="p-3 rounded-2xl bg-white border border-[#EFE6DB] text-[#6E675F] hover:text-[#2D2A26] hover:bg-[#FAF5F0] transition-all duration-200 shadow-2xs"
                title="Refresh Data"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-[#8B72F4]/30 text-[#8B72F4] font-semibold shadow-2xs hover:bg-[#8B72F4]/10 transition-all duration-200 active:scale-98"
              >
                <UploadCloud size={18} />
                <span>Import to Supabase</span>
              </button>
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#8B72F4] text-white font-semibold shadow-md hover:bg-[#785EE3] transition-all duration-200 active:scale-98"
              >
                <Plus size={18} />
                <span>Add Competency</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-[24px] p-5 border border-[#EFE6DB] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#8B72F4]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E675F]">Total Competencies</span>
              <div className="p-2 rounded-xl bg-[#8B72F4]/10">
                <BookOpen size={18} />
              </div>
            </div>
            <div className="text-2xl font-black text-[#2D2A26]">{stats.total}</div>
            <p className="text-xs text-[#9E958A]">Grades 1 to 6 Total</p>
          </div>

          <div className="bg-white rounded-[24px] p-5 border border-[#EFE6DB] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#3B82F6]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E675F]">1st Term / Q1</span>
              <div className="p-2 rounded-xl bg-[#3B82F6]/10">
                <Calendar size={18} />
              </div>
            </div>
            <div className="text-2xl font-black text-[#2D2A26]">{stats.term1Count}</div>
            <p className="text-xs text-[#9E958A]">1st Quarter BOW</p>
          </div>

          <div className="bg-white rounded-[24px] p-5 border border-[#EFE6DB] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#F59E0B]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E675F]">2nd Term / Q2</span>
              <div className="p-2 rounded-xl bg-[#F59E0B]/10">
                <Calendar size={18} />
              </div>
            </div>
            <div className="text-2xl font-black text-[#2D2A26]">{stats.term2Count}</div>
            <p className="text-xs text-[#9E958A]">2nd Quarter BOW</p>
          </div>

          <div className="bg-white rounded-[24px] p-5 border border-[#EFE6DB] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#10B981]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E675F]">3rd Term / Q3</span>
              <div className="p-2 rounded-xl bg-[#10B981]/10">
                <Calendar size={18} />
              </div>
            </div>
            <div className="text-2xl font-black text-[#2D2A26]">{stats.term3Count}</div>
            <p className="text-xs text-[#9E958A]">3rd Quarter BOW</p>
          </div>
        </div>

        {/* Filter Controls Panel */}
        <div className="bg-white rounded-[24px] p-5 border border-[#EFE6DB] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#F5EFE6] pb-3">
            <div className="flex items-center gap-2 text-[#2D2A26] font-bold text-sm">
              <Filter size={16} className="text-[#8B72F4]" />
              <span>Filter Budget of Work</span>
            </div>
            {(selectedGrade !== 'all' || selectedLearningArea !== 'all' || selectedTerm !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedGrade('all')
                  setSelectedLearningArea('all')
                  setSelectedTerm('all')
                  setSearchQuery('')
                }}
                className="text-xs text-[#8B72F4] hover:underline font-semibold"
              >
                Reset All Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Grade Level Filter */}
            <div>
              <label className="block text-xs font-semibold text-[#6E675F] mb-1.5">Grade Level</label>
              <select
                value={selectedGrade}
                onChange={e => setSelectedGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-[#EFE6DB] bg-[#FAF5F0] text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]"
              >
                <option value="all">All Grades (Grade 1 - 12)</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Learning Area Filter */}
            <div>
              <label className="block text-xs font-semibold text-[#6E675F] mb-1.5">Learning Area</label>
              <select
                value={selectedLearningArea}
                onChange={e => setSelectedLearningArea(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#EFE6DB] bg-[#FAF5F0] text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]"
              >
                <option value="all">All Learning Areas</option>
                {availableLearningAreas
                  .filter(a => a !== 'all')
                  .map(la => (
                    <option key={la} value={la}>
                      {la}
                    </option>
                  ))}
              </select>
            </div>

            {/* Term / Quarter Filter */}
            <div>
              <label className="block text-xs font-semibold text-[#6E675F] mb-1.5">Term / Quarter</label>
              <select
                value={selectedTerm}
                onChange={e => setSelectedTerm(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#EFE6DB] bg-[#FAF5F0] text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]"
              >
                <option value="all">All Terms / Quarters</option>
                {availableTerms
                  .filter(t => t !== 'all')
                  .map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>
            </div>

            {/* Search Filter */}
            <div>
              <label className="block text-xs font-semibold text-[#6E675F] mb-1.5">Search Competency</label>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9E958A]" />
                <input
                  type="text"
                  placeholder="Code, strand, description..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#EFE6DB] bg-[#FAF5F0] text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Data Table Container */}
        <div className="bg-white rounded-[24px] border border-[#EFE6DB] shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F5EFE6] flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <BookMarked size={18} className="text-[#8B72F4]" />
              <h2 className="font-bold text-[#2D2A26] text-base">Competencies Directory</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#FAF5F0] text-[#6E675F] text-xs font-semibold">
                {filteredCompetencies.length} entries
              </span>
              {isLiveFromSupabase ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                  <Database size={12} /> Live Supabase DB (sc_budget_of_work)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                  <FileJson size={12} /> Local Extracted PDF BOW JSON
                </span>
              )}
            </div>

            {/* Rows Per Page Selector */}
            <div className="flex items-center gap-2 text-xs text-[#6E675F]">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-2 py-1 rounded-lg border border-[#EFE6DB] bg-[#FAF5F0] text-xs font-semibold text-[#2D2A26]"
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
                <option value={250}>250 per page</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#6E675F] space-y-3">
              <RefreshCw size={24} className="animate-spin mx-auto text-[#8B72F4]" />
              <p className="text-sm">Loading DepEd Budget of Work competencies...</p>
            </div>
          ) : filteredCompetencies.length === 0 ? (
            <div className="p-12 text-center text-[#6E675F] space-y-3">
              <AlertCircle size={32} className="mx-auto text-[#F59E0B]" />
              <p className="font-semibold text-base">No competencies found</p>
              <p className="text-xs text-[#9E958A] max-w-md mx-auto">
                No DepEd learning competencies match your selected filter criteria. Try adjusting your filters or search query.
              </p>
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAF5F0] text-[#6E675F] text-xs font-bold uppercase tracking-wider border-b border-[#EFE6DB]">
                      <th className="py-3.5 px-4 pl-6">Code / ID</th>
                      <th className="py-3.5 px-4">Grade & Subject</th>
                      <th className="py-3.5 px-4">Term</th>
                      <th className="py-3.5 px-4">Domain / Strand</th>
                      <th className="py-3.5 px-4">Duration</th>
                      <th className="py-3.5 px-4">DepEd Learning Competency Description</th>
                      <th className="py-3.5 px-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5EFE6] text-sm text-[#2D2A26]">
                    {paginatedCompetencies.map(item => (
                      <tr key={item.id} className="hover:bg-[#FFF9F2] transition-colors duration-150">
                        <td className="py-4 px-4 pl-6 font-mono text-xs font-bold text-[#8B72F4]">
                          {item.code || 'N/A'}
                        </td>
                        <td className="py-4 px-4 space-y-1">
                          <div className="flex items-center gap-2 font-semibold">
                            <span className="px-2 py-0.5 rounded-md bg-[#8B72F4]/10 text-[#8B72F4] text-xs font-bold">
                              Grade {item.grade_number}
                            </span>
                            <span>{item.learning_area_name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-block px-2.5 py-1 rounded-full bg-[#FAF5F0] border border-[#EFE6DB] text-xs font-medium text-[#6E675F]">
                            {item.term_name}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-medium text-[#6E675F]">
                          {item.domain_strand || 'General'}
                        </td>
                        <td className="py-4 px-4 text-xs space-y-0.5 text-[#6E675F]">
                          <div className="font-semibold text-[#2D2A26]">{item.target_week || 'Week 1-2'}</div>
                          <div>{item.target_days || 5} Days Target</div>
                        </td>
                        <td className="py-4 px-4 text-sm text-[#2D2A26] max-w-md leading-relaxed">
                          {item.competency_description}
                        </td>
                        <td className="py-4 px-4 pr-6 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-2 rounded-xl text-[#6E675F] hover:text-[#8B72F4] hover:bg-[#8B72F4]/10 transition-colors"
                            title="Edit Competency"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 rounded-xl text-[#6E675F] hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Competency"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="px-6 py-4 border-t border-[#F5EFE6] flex items-center justify-between text-xs text-[#6E675F]">
                <div>
                  Showing <span className="font-bold text-[#2D2A26]">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-bold text-[#2D2A26]">{Math.min(currentPage * pageSize, filteredCompetencies.length)}</span> of{' '}
                  <span className="font-bold text-[#2D2A26]">{filteredCompetencies.length}</span> entries
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-lg border border-[#EFE6DB] bg-[#FAF5F0] hover:bg-[#EFE6DB] disabled:opacity-40 font-semibold"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-lg border border-[#EFE6DB] bg-[#FAF5F0] hover:bg-[#EFE6DB] disabled:opacity-40 font-semibold"
                  >
                    Prev
                  </button>
                  <span className="px-3 py-1 font-bold text-[#2D2A26]">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-lg border border-[#EFE6DB] bg-[#FAF5F0] hover:bg-[#EFE6DB] disabled:opacity-40 font-semibold"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-lg border border-[#EFE6DB] bg-[#FAF5F0] hover:bg-[#EFE6DB] disabled:opacity-40 font-semibold"
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Competency Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[28px] max-w-lg w-full border border-[#EFE6DB] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-gradient-to-r from-[#FAF5F0] to-[#FFF9F2] border-b border-[#EFE6DB] flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#2D2A26] font-bold text-lg">
                <BookOpen size={20} className="text-[#8B72F4]" />
                <span>{editingItem ? 'Edit Budget of Work Entry' : 'Add New DepEd Competency'}</span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-[#EFE6DB] text-[#6E675F] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#6E675F] mb-1">Grade Level</label>
                  <select
                    value={formData.grade_number}
                    onChange={e => setFormData({ ...formData, grade_number: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#EFE6DB] bg-[#FAF5F0] text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]"
                  >
                    {[1, 2, 3, 4, 5, 6].map(g => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6E675F] mb-1">Learning Area</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mathematics, Science"
                    value={formData.learning_area_name}
                    onChange={e => setFormData({ ...formData, learning_area_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#EFE6DB] bg-[#FAF5F0] text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#6E675F] mb-1">Term / Quarter</label>
                  <select
                    value={formData.term_name}
                    onChange={e => setFormData({ ...formData, term_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#EFE6DB] bg-[#FAF5F0] text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]"
                  >
                    <option value="1st Term / Quarter 1">1st Term / Quarter 1</option>
                    <option value="2nd Term / Quarter 2">2nd Term / Quarter 2</option>
                    <option value="3rd Term / Quarter 3">3rd Term / Quarter 3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6E675F] mb-1">Competency Code</label>
                  <input
                    type="text"
                    placeholder="e.g. M1NS-Ia-1.1"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#EFE6DB] bg-[#FAF5F0] text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6E675F] mb-1">Domain / Strand</label>
                <input
                  type="text"
                  placeholder="e.g. Numbers and Number Sense, Matter"
                  value={formData.domain_strand}
                  onChange={e => setFormData({ ...formData, domain_strand: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#EFE6DB] bg-[#FAF5F0] text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#6E675F] mb-1">Target Week</label>
                  <input
                    type="text"
                    placeholder="e.g. Week 1 - Day 1-5"
                    value={formData.target_week}
                    onChange={e => setFormData({ ...formData, target_week: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#EFE6DB] bg-[#FAF5F0] text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6E675F] mb-1">Target Days</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={formData.target_days}
                    onChange={e => setFormData({ ...formData, target_days: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#EFE6DB] bg-[#FAF5F0] text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6E675F] mb-1">DepEd Learning Competency Text *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter official DepEd learning competency description..."
                  value={formData.competency_description}
                  onChange={e => setFormData({ ...formData, competency_description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#EFE6DB] bg-[#FAF5F0] text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]"
                />
              </div>

              <div className="pt-3 border-t border-[#F5EFE6] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#EFE6DB] text-sm font-semibold text-[#6E675F] hover:bg-[#FAF5F0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-[#8B72F4] text-white text-sm font-semibold shadow-md hover:bg-[#785EE3] disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Competency'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import BOW Competencies to Supabase Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[28px] max-w-lg w-full border border-[#EFE6DB] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-gradient-to-r from-[#FAF5F0] to-[#FFF9F2] border-b border-[#EFE6DB] flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#2D2A26] font-bold text-lg">
                <UploadCloud size={20} className="text-[#8B72F4]" />
                <span>Import Competencies to Supabase</span>
              </div>
              <button
                disabled={isImporting}
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-[#EFE6DB] text-[#6E675F] transition-colors disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="p-4 rounded-2xl bg-[#8B72F4]/10 border border-[#8B72F4]/20 space-y-2">
                <div className="flex items-center gap-2 text-[#8B72F4] font-bold text-sm">
                  <Database size={16} />
                  <span>Target Table: sc_budget_of_work</span>
                </div>
                <p className="text-xs text-[#6E675F] leading-relaxed">
                  Importing will save competencies into the Supabase database table <code className="bg-white px-1.5 py-0.5 rounded border border-[#8B72F4]/30 font-mono text-[#8B72F4]">sc_budget_of_work</code>.
                </p>
              </div>

              {isImporting ? (
                <div className="space-y-4 py-4 text-center">
                  <RefreshCw size={28} className="animate-spin mx-auto text-[#8B72F4]" />
                  <div className="space-y-1">
                    <p className="font-bold text-[#2D2A26] text-sm">{importStatusText}</p>
                    <p className="text-xs text-[#6E675F]">
                      {importProgress.processed.toLocaleString()} / {importProgress.total.toLocaleString()} competencies uploaded
                    </p>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-[#FAF5F0] rounded-full h-3 overflow-hidden border border-[#EFE6DB]">
                    <div
                      className="bg-[#8B72F4] h-full transition-all duration-300 rounded-full"
                      style={{
                        width: `${importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Option 1: Sync 6,406 Extracted BOW Competencies */}
                  <div className="p-5 rounded-2xl border border-[#EFE6DB] bg-[#FAF5F0] hover:border-[#8B72F4] transition-all space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#2D2A26] font-bold text-sm">
                        <FileJson size={18} className="text-[#8B72F4]" />
                        <span>Extracted BOW PDF Dataset</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#8B72F4]/15 text-[#8B72F4] text-xs font-bold">
                        {extractedCompetencies.length.toLocaleString()} items
                      </span>
                    </div>
                    <p className="text-xs text-[#6E675F]">
                      Upload all {extractedCompetencies.length.toLocaleString()} DepEd Budget of Work competencies extracted from your 126 PDF files directly into Supabase.
                    </p>
                    <button
                      type="button"
                      onClick={handleImportSyncExtracted}
                      className="w-full py-2.5 rounded-xl bg-[#8B72F4] text-white font-semibold text-sm shadow-md hover:bg-[#785EE3] transition-all flex items-center justify-center gap-2"
                    >
                      <UploadCloud size={16} />
                      <span>Sync Extracted JSON to Supabase</span>
                    </button>
                  </div>

                  {/* Option 2: Upload Custom JSON File */}
                  <div className="p-5 rounded-2xl border border-[#EFE6DB] bg-white space-y-3">
                    <div className="flex items-center gap-2 text-[#2D2A26] font-bold text-sm">
                      <Plus size={18} className="text-[#F59E0B]" />
                      <span>Upload Custom JSON File</span>
                    </div>
                    <p className="text-xs text-[#6E675F]">
                      Select an external JSON file from your computer containing custom BOW competencies.
                    </p>
                    <label className="w-full py-2.5 rounded-xl border border-[#EFE6DB] bg-[#FAF5F0] hover:bg-[#EFE6DB] text-[#2D2A26] font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer">
                      <FileJson size={16} className="text-[#8B72F4]" />
                      <span>Choose JSON File</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleCustomJsonUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Option 3: Clear Supabase Table */}
                  {isLiveFromSupabase && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleClearTable}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold hover:underline"
                      >
                        Clear all data in sc_budget_of_work table in Supabase
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
